import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PublicCheckoutService {
  private readonly asaasApiUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly asaasApiKey = process.env.ASAAS_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

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
        },
      });
    }

    // 2. Criar ou buscar o Cliente no Asaas
    let asaasCustomerId: string;
    try {
      const customerResponse = await axios.post(
        `${this.asaasApiUrl}/customers`,
        {
          name: dto.arenaName,
          email: dto.email,
          cpfCnpj: dto.cpfCnpj,
        },
        { headers: { access_token: this.asaasApiKey } },
      );
      asaasCustomerId = customerResponse.data.id;
    } catch (error) {
      throw new BadRequestException('Erro ao cadastrar cliente no gateway de pagamento.');
    }

    // 3. Criar registro da Assinatura no banco local
    const subscription = await this.prisma.arenaSubscription.create({
      data: {
        arenaId: arena.id,
        platformPlanId: plan.id,
        status: 'PENDING',
      },
    });

    // 4. Criar Assinatura no Asaas informando o externalReference
    try {
      const subResponse = await axios.post(
        `${this.asaasApiUrl}/subscriptions`,
        {
          customer: asaasCustomerId,
          billingType: 'UNDEFINED', // Permite o usuário escolher Pix/Cartão na fatura
          value: plan.price,
          nextDueDate: new Date().toISOString().split('T')[0],
          cycle: plan.billingCycle,
          description: `Assinatura Plano ${plan.name} - ${dto.arenaName}`,
          externalReference: `arena_sub:${subscription.id}`,
        },
        { headers: { access_token: this.asaasApiKey } },
      );

      // Atualiza ID do Asaas na assinatura local
      await this.prisma.arenaSubscription.update({
        where: { id: subscription.id },
        data: { asaasSubscriptionId: subResponse.data.id },
      });

      return {
        subscriptionId: subscription.id,
        invoiceUrl: subResponse.data.invoiceUrl,
      };
    } catch (error) {
      throw new BadRequestException('Erro ao gerar cobrança da assinatura no Asaas.');
    }
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