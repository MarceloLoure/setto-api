import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { Role } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PublicCheckoutService {
  private readonly asaasApiUrl = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  private readonly asaasApiKey = process.env.ASAAS_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private get headers() {
    return { access_token: this.asaasApiKey };
  }

  async processCheckout(dto: PublicCheckoutDto) {
    const plan = await this.prisma.platformPlan.findUnique({
      where: { id: dto.platformPlanId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plano selecionado inválido ou inativo.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Este e-mail já possui uma conta na Setto. Faça login e contrate o plano pelo painel de gestão.',
      );
    }

    // Variables for tracking created DB records (for rollback on gateway errors)
    let newAdminCreatedId: string | null = null;
    let arenaCreatedId: string | null = null;

    // 1. Criar ou reutilizar o registro da Arena
    const existingArena = await this.prisma.arena.findFirst({
      where: { email: dto.email },
      include: { admins: { select: { id: true } } },
    });

    const cleanArenaDoc = dto.cpfCnpj.replace(/\D/g, '');
    const isCnpj = cleanArenaDoc.length > 11;

    let arena;

    if (!existingArena) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newAdmin = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          phone: dto.phone,
          cpf: dto.cpf,
          role: Role.ARENA_ADMIN,
        },
      });
      newAdminCreatedId = newAdmin.id;

      arena = await this.prisma.arena.create({
        data: {
          name: dto.arenaName,
          cnpj: cleanArenaDoc,
          email: dto.email,
          city: dto.city!,
          state: dto.state!,
          zipCode: dto.zipCode!,
          phone: dto.phone,
          admins: { connect: { id: newAdmin.id } },
        },
        include: { admins: { select: { id: true } } },
      });
      arenaCreatedId = arena.id;
    } else if (existingArena.admins.length === 0) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newAdmin = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          phone: dto.phone,
          role: Role.ARENA_ADMIN,
        },
      });
      newAdminCreatedId = newAdmin.id;

      arena = await this.prisma.arena.update({
        where: { id: arena.id },
        data: { admins: { connect: { id: newAdmin.id } } },
        include: { admins: { select: { id: true } } },
      });
    }

    const arenaAdmin = await this.prisma.user.findUniqueOrThrow({
      where: { id: arena.admins[0].id },
      include: {
        avatar: { select: { id: true, name: true, path: true } },
      },
    });

    // 2. Criar ou buscar o Cliente no Asaas
    let asaasCustomerId: string;
    try {
      const existingResponse = await axios.get(
        `${this.asaasApiUrl}/customers?cpfCnpj=${dto.cpfCnpj}`,
        { headers: this.headers },
      );

      if (existingResponse.data?.data?.length > 0) {
        asaasCustomerId = existingResponse.data.data[0].id;
      } else {
        const customerResponse = await axios.post(
          `${this.asaasApiUrl}/customers`,
          {
            name: dto.arenaName,
            email: dto.email,
            cpfCnpj: dto.cpfCnpj,
            phone: dto.phone,
          },
          { headers: this.headers },
        );
        asaasCustomerId = customerResponse.data.id;
      }
    } catch (error) {
      console.error('Erro Asaas Customer:', error?.response?.data || error);
      await this.rollbackTransaction(arenaCreatedId, newAdminCreatedId);
      throw new BadRequestException('Erro ao cadastrar ou localizar cliente no gateway de pagamento.');
    }

    // 3. Criar registro da Assinatura no banco local
    const subscription = await this.prisma.arenaSubscription.create({
      data: {
        arenaId: arena.id,
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
      description: `Assinatura Plano ${plan.name} - ${dto.arenaName}`,
      externalReference: `arena_sub:${subscription.id}`,
    };

    // 4. Tratar parâmetros de cartão de crédito
    if (dto.billingType === 'CREDIT_CARD') {
      if (dto.cardId) {
        const savedCard = await this.prisma.creditCard.findUnique({
          where: { id: dto.cardId },
        });

        if (!savedCard) {
          await this.rollbackTransaction(arenaCreatedId, newAdminCreatedId, subscription.id);
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
          email: dto.email,
          cpfCnpj: dto.cpfCnpj,
          postalCode: dto.creditCardHolderInfo?.postalCode || dto.zipCode || '00000000',
          addressNumber: dto.creditCardHolderInfo?.addressNumber || 'S/N',
          phone: dto.phone,
          mobilePhone: dto.phone,
        };
      } else {
        await this.rollbackTransaction(arenaCreatedId, newAdminCreatedId, subscription.id);
        throw new BadRequestException('Dados do cartão, cardId ou creditCardToken são obrigatórios.');
      }
    }

    // 5. Criar Assinatura no Asaas
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
      console.error('Erro Asaas Subscription:', asaasError || error);
      
      await this.rollbackTransaction(arenaCreatedId, newAdminCreatedId, subscription.id);
      
      const asaasMsg = asaasError?.errors?.[0]?.description || 'Erro ao gerar cobrança da assinatura no Asaas.';
      throw new BadRequestException(asaasMsg);
    }

    // 6. Gerar JWT e resposta no mesmo formato do AuthService
    const accessToken = this.jwtService.sign({
      sub: arenaAdmin.id,
      email: arenaAdmin.email,
      role: arenaAdmin.role,
    });

    const paymentResponseDetails: any = {
      subscriptionId: subscription.id,
      asaasSubscriptionId: asaasSub.id,
      billingType: dto.billingType,
      accessToken,
      user: {
        id: arenaAdmin.id,
        name: arenaAdmin.name,
        email: arenaAdmin.email,
        role: arenaAdmin.role,
        avatar: arenaAdmin.avatar ?? null,
        isManager: true,
      },
      arena: {
        id: arena.id,
        name: arena.name,
      },
    };

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

          paymentResponseDetails.pix = {
            encodedImage: qrCodeResponse.data.encodedImage,
            payload: qrCodeResponse.data.payload,
            expirationDate: qrCodeResponse.data.expirationDate,
            paymentId: firstPayment.id,
          };
        }
      } catch (error) {
        console.error('Erro ao buscar Pix QR Code:', error?.response?.data || error);
        paymentResponseDetails.invoiceUrl = asaasSub.invoiceUrl;
      }
    } else if (dto.billingType === 'CREDIT_CARD') {
      paymentResponseDetails.status = asaasSub.status;
      paymentResponseDetails.invoiceUrl = asaasSub.invoiceUrl;
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