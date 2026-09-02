import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, PaymentCategory, PaymentMethod, PaymentStatus, SubscriptionStatus, PlanBillingCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasWebhookDto, AsaasWebhookPaymentPayload } from './dto/asaas-webhook.dto';

/**
 * Convenção de `externalReference` usada em toda cobrança/assinatura criada
 * pela Setto na Asaas, pra sabermos a qual registro local ela se refere
 * quando o webhook chega de volta: "<tipo>:<id-local>".
 *   booking:<bookingId>
 *   arena_sub:<arenaSubscriptionId>
 *   membership:<athleteMembershipId>
 */
type ReferenceKind = 'booking' | 'arena_sub' | 'membership';
type ParsedReference = { type: ReferenceKind; id: string } | null;

function parseExternalReference(ref?: string | null): ParsedReference {
  if (!ref) return null;
  const [type, id] = ref.split(':');
  if (!id || !['booking', 'arena_sub', 'membership'].includes(type)) return null;
  return { type: type as ReferenceKind, id };
}

function mapBillingTypeToMethod(billingType: string): PaymentMethod {
  switch (billingType) {
    case 'PIX':
      return PaymentMethod.PIX;
    case 'CREDIT_CARD':
      return PaymentMethod.CREDIT_CARD;
    case 'DEBIT_CARD':
      return PaymentMethod.DEBIT_CARD;
    default:
      // Boleto e outros meios ainda não mapeados no enum interno.
      return PaymentMethod.PIX;
  }
}

function addCycle(date: Date, cycle: PlanBillingCycle): Date {
  const next = new Date(date);
  switch (cycle) {
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'SEMIANNUALLY':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'ANNUALLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

@Injectable()
export class AsaasWebhookService {
  private readonly logger = new Logger(AsaasWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processEvent(payload: AsaasWebhookDto) {
    this.logger.log(`[Asaas] Evento recebido: ${payload.event}`);

    switch (payload.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        return this.handlePaymentReceived(payload.payment);
      case 'PAYMENT_OVERDUE':
        return this.handlePaymentOverdue(payload.payment);
      case 'PAYMENT_DELETED':
        return this.handlePaymentCancelled(payload.payment, 'CANCELLED');
      case 'PAYMENT_REFUNDED':
        return this.handlePaymentCancelled(payload.payment, 'REFUNDED');
      case 'SUBSCRIPTION_DELETED':
        return this.handleSubscriptionDeleted(payload.subscription);
      default:
        this.logger.log(`[Asaas] Evento "${payload.event}" ignorado (sem handler específico).`);
        return;
    }
  }

  private async handlePaymentReceived(payment?: AsaasWebhookPaymentPayload) {
    if (!payment) return;
    const ref = parseExternalReference(payment.externalReference);

    // Cobrança avulsa de uma reserva (Vertical 1)
    if (ref?.type === 'booking') {
      return this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id: ref.id } });
        if (!booking) {
          this.logger.warn(`[Asaas] Webhook de pagamento aponta pra booking inexistente: ${ref.id}`);
          return;
        }

        await tx.payment.upsert({
          where: { asaasPaymentId: payment.id },
          create: {
            description: `Pagamento da reserva #${booking.id}`,
            amount: payment.value ?? 0,
            method: mapBillingTypeToMethod(payment.billingType),
            category: PaymentCategory.BOOKING,
            status: PaymentStatus.COMPLETED,
            paidAt: payment.confirmedDate ? new Date(payment.confirmedDate) : new Date(),
            asaasPaymentId: payment.id,
            arenaId: booking.arenaId,
            bookingId: booking.id,
            userId: booking.userId,
            createdById: booking.userId ?? booking.arenaId, // cobrança online, sem operador humano
          },
          update: {
            status: PaymentStatus.COMPLETED,
            paidAt: payment.confirmedDate ? new Date(payment.confirmedDate) : new Date(),
          },
        });

        await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED } });
      });
    }

    // Assinatura da plataforma Setto (Vertical 2) ou mensalidade de atleta (Vertical 3)
    if (ref?.type === 'arena_sub' || payment.subscription) {
      return this.extendSubscriptionCycle('arena_sub', ref?.id, payment.subscription);
    }
    if (ref?.type === 'membership') {
      return this.extendSubscriptionCycle('membership', ref.id, payment.subscription);
    }

    this.logger.warn(`[Asaas] Pagamento ${payment.id} recebido sem externalReference reconhecível.`);
  }

  private async extendSubscriptionCycle(kind: 'arena_sub' | 'membership', localId?: string, asaasSubscriptionId?: string) {
    if (kind === 'arena_sub') {
      const subscription = localId
        ? await this.prisma.arenaSubscription.findUnique({ where: { id: localId }, include: { platformPlan: true } })
        : asaasSubscriptionId
          ? await this.prisma.arenaSubscription.findUnique({ where: { asaasSubscriptionId }, include: { platformPlan: true } })
          : null;
      if (!subscription) {
        this.logger.warn(`[Asaas] Assinatura de plataforma não encontrada (local=${localId}, asaas=${asaasSubscriptionId}).`);
        return;
      }
      const now = new Date();
      await this.prisma.arenaSubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentCycleStart: now,
          currentCycleEnd: addCycle(now, subscription.platformPlan.billingCycle),
        },
      });
      return;
    }

    const membership = localId
      ? await this.prisma.athleteMembership.findUnique({ where: { id: localId }, include: { plan: true } })
      : asaasSubscriptionId
        ? await this.prisma.athleteMembership.findUnique({ where: { asaasSubscriptionId }, include: { plan: true } })
        : null;
    if (!membership) {
      this.logger.warn(`[Asaas] Mensalidade de atleta não encontrada (local=${localId}, asaas=${asaasSubscriptionId}).`);
      return;
    }
    const now = new Date();
    await this.prisma.athleteMembership.update({
      where: { id: membership.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentCycleStart: now,
        currentCycleEnd: addCycle(now, membership.plan.billingCycle),
      },
    });
  }

  private async handlePaymentOverdue(payment?: AsaasWebhookPaymentPayload) {
    if (!payment) return;
    const ref = parseExternalReference(payment.externalReference);

    if (ref?.type === 'arena_sub' || (payment.subscription && !ref)) {
      const subscription = await this.prisma.arenaSubscription.findFirst({
        where: ref?.type === 'arena_sub' ? { id: ref.id } : { asaasSubscriptionId: payment.subscription },
      });
      if (subscription) {
        await this.prisma.arenaSubscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.OVERDUE } });
      }
      // Guard de acesso (SubscriptionGuard) consulta esse status em tempo real
      // pra bloquear rotas administrativas da arena — nada a fazer aqui além
      // de atualizar o status.
      return;
    }

    if (ref?.type === 'membership') {
      await this.prisma.athleteMembership.update({ where: { id: ref.id }, data: { status: SubscriptionStatus.OVERDUE } }).catch(() => {
        this.logger.warn(`[Asaas] Mensalidade ${ref.id} não encontrada pra marcar OVERDUE.`);
      });
    }
  }

  private async handlePaymentCancelled(payment: AsaasWebhookPaymentPayload | undefined, status: 'CANCELLED' | 'REFUNDED') {
    if (!payment) return;
    const existing = await this.prisma.payment.findUnique({ where: { asaasPaymentId: payment.id }, include: { booking: true } });
    if (!existing) {
      this.logger.warn(`[Asaas] Pagamento ${payment.id} (${status}) não encontrado localmente — nada a fazer.`);
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: existing.id }, data: { status: PaymentStatus[status] } });
      if (existing.bookingId) {
        await tx.booking.update({ where: { id: existing.bookingId }, data: { status: BookingStatus.CANCELLED } });
      }
    });
  }

  private async handleSubscriptionDeleted(subscription?: { id: string }) {
    if (!subscription) return;
    const arenaSub = await this.prisma.arenaSubscription.findUnique({ where: { asaasSubscriptionId: subscription.id } });
    if (arenaSub) {
      await this.prisma.arenaSubscription.update({ where: { id: arenaSub.id }, data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() } });
      return;
    }
    const membership = await this.prisma.athleteMembership.findUnique({ where: { asaasSubscriptionId: subscription.id } });
    if (membership) {
      await this.prisma.athleteMembership.update({ where: { id: membership.id }, data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() } });
    }
  }
}
