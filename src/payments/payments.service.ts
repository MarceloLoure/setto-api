import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, ParticipantStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCategory, Role } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(user: any, dto: CreatePaymentDto) {

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

    if (dto.bookingId) {
      return this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: dto.bookingId },
          include: { payment: true },
        });

        if (!booking) {
          throw new NotFoundException('Agendamento não encontrado.');
        }

        if (booking.payment) {
          throw new BadRequestException('Este agendamento já possui um pagamento registrado.');
        }

        // Cria o pagamento liquidado
        const payment = await tx.payment.create({
          data: {
            description: dto.description,
            amount: dto.amount,
            method: dto.method,
            category: PaymentCategory.BOOKING,
            status: 'COMPLETED',
            paidAt: new Date(),
            arenaId: dto.arenaId,
            bookingId: dto.bookingId,
            userId: dto.userId || booking.userId || null,
            createdById: user.id,
          },
          include: {
            booking: { select: { id: true, startTime: true, court: { select: { name: true } } } },
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } },
          },
        });

        await tx.booking.update({
          where: { id: dto.bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });

        return payment;
      });
    }

    return this.prisma.payment.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        method: dto.method,
        category: dto.category || PaymentCategory.OTHER,
        status: BookingStatus.COMPLETED,
        paidAt: new Date(),
        arenaId: dto.arenaId,
        userId: dto.userId || null,
        createdById: user.id,
      },
      include: {
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