import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  // Roda a cada 1 minuto
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredBookings() {
    const now = new Date();

    // 1. Busca todas as reservas PENDING expiradas
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: {
          lt: now, // lt = less than (expiresAt < agora)
        },
      },
      include: {
        payment: true, // Inclui o pagamento (ou payments se for array)
      },
    });

    if (expiredBookings.length === 0) {
      return;
    }

    this.logger.log(`[Cron Expiracao] Encontradas ${expiredBookings.length} reservas expiradas para cancelar.`);

    for (const booking of expiredBookings) {
      try {
        // 2. Transação no banco local: Cancela a reserva e seus pagamentos pendentes
        await this.prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CANCELLED },
          });

          await tx.payment.updateMany({
            where: {
              bookingId: booking.id,
              status: PaymentStatus.PENDING,
            },
            data: { status: PaymentStatus.CANCELLED },
          });
        });

        // 3. Cancela a cobrança no Asaas
        const paymentData = (booking as any).payment || (booking as any).payments;

        if (Array.isArray(paymentData)) {
          // Se no schema for relação de 1 para N (array)
          for (const payment of paymentData) {
            if (payment?.asaasPaymentId && payment.status === PaymentStatus.PENDING) {
              await this.asaasService.cancelPayment(payment.asaasPaymentId).catch((err) => {
                this.logger.warn(
                  `Falha ao cancelar cobrança Asaas (${payment.asaasPaymentId}) da reserva expirada ${booking.id}: ${err.message}`,
                );
              });
            }
          }
        } else if (paymentData?.asaasPaymentId && paymentData.status === PaymentStatus.PENDING) {
          // Se no schema for relação de 1 para 1 (objeto único)
          await this.asaasService.cancelPayment(paymentData.asaasPaymentId).catch((err) => {
            this.logger.warn(
              `Falha ao cancelar cobrança Asaas (${paymentData.asaasPaymentId}) da reserva expirada ${booking.id}: ${err.message}`,
            );
          });
        }

        this.logger.log(`[Cron Expiracao] Reserva ${booking.id} expirada e liberada com sucesso.`);
      } catch (error) {
        this.logger.error(`Erro ao processar expiração da reserva ${booking.id}:`, error);
      }
    }
  }
}