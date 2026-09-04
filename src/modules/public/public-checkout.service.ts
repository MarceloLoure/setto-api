import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PublicCheckoutService {
  private readonly asaasApiUrl = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  private readonly asaasApiKey = process.env.ASAAS_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

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

    // 1. Criar ou reutilizar o registro temporário da Arena
    let arena = await this.prisma.arena.findFirst({
      where: { email: dto.email },
    });

    if (!arena) {
      arena = await this.prisma.arena.create({
        data: {
          name: dto.arenaName,
          email: dto.email,
          isActive: false,
          city: dto.city,
          state: dto.state,
          zipCode: dto.zipCode,
          phone: dto.phone,
        },
      });
    }

    // 2. Criar ou buscar o Cliente no Asaas
    let asaasCustomerId: string;
    try {
      // Tenta buscar se já existe por CPF/CNPJ
      const existingResponse = await axios.get(
        `${this.asaasApiUrl}/customers?cpfCnpj=${dto.cpfCnpj}`,
        { headers: this.headers },
      );

      if (existingResponse.data?.data?.length > 0) {
        asaasCustomerId = existingResponse.data.data[0].id;
      } else {
        // Se não existir, cria o cliente
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
      console.error('Erro Asaas Customer:', error?.[0]?.data || error);
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

    // 4. Montar o payload da assinatura no Asaas
    const todayStr = new Date().toISOString().split('T')[0];
    const subPayload: any = {
      customer: asaasCustomerId,
      billingType: dto.billingType, // 'PIX' ou 'CREDIT_CARD'
      value: Number(plan.price),
      nextDueDate: todayStr,
      cycle: plan.billingCycle, // ex: 'MONTHLY', 'YEARLY'
      description: `Assinatura Plano ${plan.name} - ${dto.arenaName}`,
      externalReference: `arena_sub:${subscription.id}`,
    };

    // Se for cartão de crédito, injeta os dados do cartão no payload
    if (dto.billingType === 'CREDIT_CARD') {
      if (!dto.creditCard) {
        throw new BadRequestException('Dados do cartão de crédito são obrigatórios para este método.');
      }
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
      };
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

      // Atualiza o ID da assinatura do Asaas no banco
      await this.prisma.arenaSubscription.update({
        where: { id: subscription.id },
        data: { asaasSubscriptionId: asaasSub.id },
      });
    } catch (error) {
      const asaasError = axios.isAxiosError(error) ? error.response?.data : undefined;
      console.error('Erro Asaas Subscription:', asaasError || error);
      // Rollback da assinatura local em caso de erro
      await this.prisma.arenaSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
      const asaasMsg = asaasError?.errors?.[0]?.description || 'Erro ao gerar cobrança da assinatura no Asaas.';
      throw new BadRequestException(asaasMsg);
    }

    // 6. Tratar retorno conforme a forma de pagamento selecionada
    let paymentResponseDetails: any = {
      subscriptionId: subscription.id,
      asaasSubscriptionId: asaasSub.id,
      billingType: dto.billingType,
    };

    if (dto.billingType === 'PIX') {
      try {
        // Ao criar a assinatura no Asaas, ele gera automaticamente o primeiro 'payment'.
        // Buscamos as cobranças vinculadas a essa assinatura para obter o Pix QrCode.
        const paymentsListResponse = await axios.get(
          `${this.asaasApiUrl}/subscriptions/${asaasSub.id}/payments`,
          { headers: this.headers },
        );

        const firstPayment = paymentsListResponse.data?.data?.[0];

        if (firstPayment?.id) {
          // Busca o QR Code e a chave Copia e Cola do PIX
          const qrCodeResponse = await axios.get(
            `${this.asaasApiUrl}/payments/${firstPayment.id}/pixQrCode`,
            { headers: this.headers },
          );

          paymentResponseDetails.pix = {
            encodedImage: qrCodeResponse.data.encodedImage, // Imagem Base64 do QR Code
            payload: qrCodeResponse.data.payload,           // Chave Copia e Cola
            expirationDate: qrCodeResponse.data.expirationDate,
            paymentId: firstPayment.id,
          };
        }
      } catch (error) {
        console.error('Erro ao buscar Pix QR Code:', error?.[0]?.data || error);
        paymentResponseDetails.invoiceUrl = asaasSub.invoiceUrl; // Fallback para link de fatura
      }
    } else if (dto.billingType === 'CREDIT_CARD') {
      // Retorna o status do processamento do cartão
      paymentResponseDetails.status = asaasSub.status; // 'ACTIVE', 'CONFIRMED', etc.
      paymentResponseDetails.invoiceUrl = asaasSub.invoiceUrl;
    }

    return paymentResponseDetails;
  }

  async validateInviteToken(token: string) {
    const registrationToken = await this.prisma.arenaRegistrationToken.findUnique({
      where: { token },
      include: {
        plan: true,
      },
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