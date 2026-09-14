import { Injectable, BadRequestException, NotFoundException, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { Role } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/email/mail.service';

@Injectable()
export class PublicCheckoutService {
  private readonly logger = new Logger(PublicCheckoutService.name);
  private readonly asaasApiUrl = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  private readonly asaasApiKey = process.env.ASAAS_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private get headers() {
    return { access_token: this.asaasApiKey };
  }

  async processCheckout(dto: PublicCheckoutDto) {
   const cleanDoc = dto.cpfCnpj.replace(/\D/g, '');
    const userEmail = dto.email.toLowerCase().trim();

    const plan = await this.prisma.platformPlan.findUnique({
      where: { id: dto.platformPlanId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plano selecionado inválido ou inativo.');
    }

    // 2. Trava de Segurança contra Invasão de Arena Existente
    const existingArena = await this.prisma.arena.findFirst({
      where: {
        OR: [{ cnpj: cleanDoc }, { email: userEmail }],
      },
    });

    if (existingArena) {
      throw new ConflictException(
        'Esta Arena (CNPJ/CPF ou E-mail) já está cadastrada no sistema. Entre em contato com o suporte se precisar de ajuda.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        password: true, // <--- GARANTE A BUSCA DO HASH DA SENHA
        name: true,
        role: true,
      },
    });

    let adminUser;
    let isNewUser = false;

    if (existingUser) {
      // Usuário já possui conta (ex: Atleta). Valida a senha para confirmar a posse da conta.
      if (!existingUser.password) {
        throw new UnauthorizedException('Conta existente sem senha definida. Redefina sua senha.');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, existingUser.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Senha incorreta para a conta de usuário informada.');
      }

      // Atualiza o perfil para o papel de Administrador de Arena se ainda não for
      adminUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: Role.ARENA_ADMIN,
          ...(dto.phone && { phone: dto.phone }),
          ...(dto.cpf && { cpf: dto.cpf }),
        },
      });
    } else {
      // Criação de nova conta de Usuário Gestor
      isNewUser = true;
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      adminUser = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          phone: dto.phone,
          cpf: dto.cpf,
          role: Role.ARENA_ADMIN,
        },
      });
    }

    // Tracker para Rollback caso ocorra falha na integração com Gateway
    let newUserIdForRollback: string | null = isNewUser ? adminUser.id : null;

    // 4. Integração com Gateway de Pagamento (Asaas Customer da Plataforma)
    let asaasCustomerId: string;
    try {
      const existingCustomerResponse = await axios.get(
        `${this.asaasApiUrl}/customers?cpfCnpj=${cleanDoc}`,
        { headers: this.headers },
      );

      if (existingCustomerResponse.data?.data?.length > 0) {
        asaasCustomerId = existingCustomerResponse.data.data[0].id;
      } else {
        const customerResponse = await axios.post(
          `${this.asaasApiUrl}/customers`,
          {
            name: dto.arenaName || dto.name,
            email: userEmail,
            cpfCnpj: cleanDoc,
            phone: dto.phone,
          },
          { headers: this.headers },
        );
        asaasCustomerId = customerResponse.data.id;
      }
    } catch (error) {
      this.logger.error('Erro Asaas Customer:', error?.response?.data || error);
      await this.rollbackTransaction(null, newUserIdForRollback);
      throw new BadRequestException('Erro ao registrar cliente no gateway de pagamento.');
    }

    // 5. Criar registro da Assinatura no banco local (ainda sem arenaId)
    const subscription = await this.prisma.arenaSubscription.create({
      data: {
        platformPlanId: plan.id,
        status: 'PENDING',
      },
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const subPayload: any = {
      customer: asaasCustomerId,
      billingType: dto.billingType,
      value: Number(plan.price),
      nextDueDate: todayStr,
      cycle: plan.billingCycle,
      description: `Assinatura Plano ${plan.name} - ${dto.arenaName || dto.name}`,
      externalReference: `arena_sub:${subscription.id}`,
    };

    if (dto.billingType === 'CREDIT_CARD') {
      if (dto.cardId) {
        const savedCard = await this.prisma.creditCard.findUnique({
          where: { id: dto.cardId },
        });

        if (!savedCard) {
          await this.rollbackTransaction(subscription.id, newUserIdForRollback);
          throw new BadRequestException('Cartão de crédito informado não foi encontrado.');
        }
        subPayload.creditCardToken = savedCard.asaasToken;
      } else if (dto.creditCardToken) {
        subPayload.creditCardToken = dto.creditCardToken;
      } else if (dto.creditCard) {
        subPayload.creditCard = {
          holderName: dto.creditCard.holderName,
          number: dto.creditCard.number,
          expiryMonth: dto.creditCard.expiryMonth,
          expiryYear: dto.creditCard.expiryYear,
          ccv: dto.creditCard.ccv,
        };
        subPayload.creditCardHolderInfo = {
          name: dto.creditCardHolderInfo?.name || dto.creditCard.holderName,
          email: userEmail,
          cpfCnpj: cleanDoc,
          postalCode: dto.creditCardHolderInfo?.postalCode || '00000000',
          addressNumber: dto.creditCardHolderInfo?.addressNumber || 'S/N',
          phone: dto.phone,
          mobilePhone: dto.phone,
        };
      } else {
        await this.rollbackTransaction(subscription.id, newUserIdForRollback);
        throw new BadRequestException('Dados do cartão, cardId ou creditCardToken são obrigatórios.');
      }
    }

    // 6. Criar Assinatura no Asaas
    let asaasSub: any;
    try {
      const subResponse = await axios.post(
        `${this.asaasApiUrl}/subscriptions`,
        subPayload,
        { headers: this.headers },
      );
      asaasSub = subResponse.data;

      await this.prisma.arenaSubscription.update({
        where: { id: subscription.id },
        data: { asaasSubscriptionId: asaasSub.id },
      });
    } catch (error) {
      const asaasError = axios.isAxiosError(error) ? error.response?.data : undefined;
      this.logger.error('Erro Asaas Subscription:', asaasError || error);
      await this.rollbackTransaction(subscription.id, newUserIdForRollback);
      const asaasMsg = asaasError?.errors?.[0]?.description || 'Erro ao gerar cobrança da assinatura no Asaas.';
      throw new BadRequestException(asaasMsg);
    }

    // 7. Criar o Token de Onboarding da Arena (MANTÉM!)
    const tokenString = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

    const registrationToken = await this.prisma.arenaRegistrationToken.create({
      data: {
        token: tokenString,
        email: userEmail,
        planId: plan.id,
        expiresAt,
      },
    });

    // 8. Tratamento PIX / Resposta
    const paymentResponseDetails: any = {
      subscriptionId: subscription.id,
      asaasSubscriptionId: asaasSub.id,
      billingType: dto.billingType,
      inviteToken: registrationToken.token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    };

    let pixData: { encodedImage?: string; payload?: string; expirationDate?: string } | undefined;
    let invoiceUrl: string = asaasSub.invoiceUrl;

    if (dto.billingType === 'PIX') {
      try {
        const paymentsListResponse = await axios.get(
          `${this.asaasApiUrl}/subscriptions/${asaasSub.id}/payments`,
          { headers: this.headers },
        );

        const firstPayment = paymentsListResponse.data?.data?.[0];

        if (firstPayment?.id) {
          const qrCodeResponse = await axios.get(
            `${this.asaasApiUrl}/payments/${firstPayment.id}/pixQrCode`,
            { headers: this.headers },
          );

          pixData = {
            encodedImage: qrCodeResponse.data.encodedImage,
            payload: qrCodeResponse.data.payload,
            expirationDate: qrCodeResponse.data.expirationDate,
          };

          paymentResponseDetails.pix = {
            ...pixData,
            paymentId: firstPayment.id,
          };
          if (firstPayment.invoiceUrl) {
            invoiceUrl = firstPayment.invoiceUrl;
          }
        }
      } catch (error) {
        this.logger.error('Erro ao buscar Pix QR Code:', error?.response?.data || error);
      }
    } else if (dto.billingType === 'CREDIT_CARD') {
      paymentResponseDetails.status = asaasSub.status;
    }

    return paymentResponseDetails;
  }

  // Helper para limpar registros do banco em caso de erro nos passos seguintes
  private async rollbackTransaction(arenaId?: string | null, userId?: string | null, subId?: string | null) {
    if (subId) await this.prisma.arenaSubscription.delete({ where: { id: subId } }).catch(() => {});
    if (arenaId) await this.prisma.arena.delete({ where: { id: arenaId } }).catch(() => {});
    if (userId) await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  async validateInviteToken(token: string) {
    const registrationToken = await this.prisma.arenaRegistrationToken.findUnique({
      where: { token },
      include: { plan: true },
    });

    if (!registrationToken) {
      throw new NotFoundException('Convite ou token inválido.');
    }

    if (registrationToken.isUsed) {
      throw new BadRequestException('Este convite já foi utilizado.');
    }

    if (new Date() > registrationToken.expiresAt) {
      throw new BadRequestException('Este convite expirou.');
    }

    return {
      valid: true,
      email: registrationToken.email,
      planName: registrationToken.plan.name,
      planId: registrationToken.planId,
    };
  }
}