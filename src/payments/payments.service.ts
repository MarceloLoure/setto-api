import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCategory, Role } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(user: any, dto: CreatePaymentDto) {
    // 1. Valida se o usuário pode lançar pagamentos para essa arena (ADMIN ou RECEPTIONIST)
    if (user.role !== Role.SUPERADMIN) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          arenasManaged: { select: { id: true } },
          arenasEmployed: { select: { id: true } },
        },
      });

      const allowedArenaIds = [
        ...(dbUser?.arenasManaged.map((a) => a.id) || []),
        ...(dbUser?.arenasEmployed.map((a) => a.id) || []),
      ];

      if (!allowedArenaIds.includes(dto.arenaId)) {
        throw new ForbiddenException('Você não tem permissão para lançar pagamentos nesta arena.');
      }
    }

    // 2. Se o pagamento for vinculado a um agendamento
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { payment: true },
      });

      if (!booking) {
        throw new NotFoundException('Agendamento não encontrado.');
      }

      if (booking.payment) {
        throw new BadRequestException('Este agendamento já possui um pagamento registrado.');
      }
    }

    // 3. Cria a entrada financeira no banco
    return this.prisma.payment.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        method: dto.method,
        category: dto.bookingId ? PaymentCategory.BOOKING : dto.category || PaymentCategory.OTHER,
        arenaId: dto.arenaId,
        bookingId: dto.bookingId || null,
        userId: dto.userId || null,
        createdById: user.id,
      },
      include: {
        booking: { select: { id: true, startTime: true, court: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async findByArena(user: any, arenaId: string) {
    if (user.role !== Role.SUPERADMIN) {
        const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
            arenasManaged: { select: { id: true } },
            arenasEmployed: { select: { id: true } },
        },
        });

        const allowedArenaIds = [
        ...(dbUser?.arenasManaged.map((a) => a.id) || []),
        ...(dbUser?.arenasEmployed.map((a) => a.id) || []),
        ];

        if (!allowedArenaIds.includes(arenaId)) {
        throw new ForbiddenException(
            'Você não tem permissão para visualizar o financeiro desta arena.',
        );
        }
    }

    return this.prisma.payment.findMany({
        where: { arenaId },
        include: {
        booking: { select: { id: true, court: { select: { name: true } } } },
        user: { select: { name: true } },
        createdBy: { select: { name: true } },
        },
        orderBy: { paidAt: 'desc' },
    });
    }
}