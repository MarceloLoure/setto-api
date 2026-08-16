import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { BookingStatus, Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(user: any, dto: CreateBookingDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const now = new Date();

    // 1. Validações Temporais
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Formato de data inválido.');
    }
    if (start >= end) {
      throw new BadRequestException('O horário de início deve ser anterior ao horário de término.');
    }
    if (start < now) {
      throw new BadRequestException('Não é possível criar agendamentos no passado.');
    }

    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationInHours < 0.5) {
      throw new BadRequestException('O tempo mínimo de agendamento é de 30 minutos.');
    }

    // 2. Transação Serializável para Prevenir Overbooking
    return this.prisma.$transaction(
      async (tx) => {
        // Busca a quadra real, pegando hourlyRate e arenaId direto do banco
        const court = await tx.court.findUnique({
          where: { id: dto.courtId },
          include: {
            arena: {
              include: {
                admins: { select: { id: true } },
                staff: { select: { id: true } },
              },
            },
          },
        });

        if (!court || !court.isActive) {
          throw new NotFoundException('Quadra não encontrada ou inativa.');
        }
        if (!court.arena.isActive) {
          throw new BadRequestException('A arena desta quadra está inativa no momento.');
        }

        // 3. Controle de Impersonação (Criação de Balcão vs Atleta)
        const isArenaStaff =
          court.arena.admins.some((a) => a.id === user.id) ||
          court.arena.staff.some((s) => s.id === user.id) ||
          user.role === Role.SUPERADMIN;

        let targetUserId = user.id;

        if (dto.userId || dto.customerName) {
          if (!isArenaStaff) {
            throw new ForbiddenException(
              'Apenas administradores ou funcionários da arena podem criar reservas para terceiros.',
            );
          }
          targetUserId = dto.userId || null;
        }

        // 4. Cálculo Imutável de Preço no Backend
        const hourlyRate = Number(court.hourlyRate);
        const calculatedTotal = Number((durationInHours * hourlyRate).toFixed(2));

        // 5. Checagem de Conflito de Horário
        const conflictingBooking = await tx.booking.findFirst({
          where: {
            courtId: court.id,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
            AND: [
              { startTime: { lt: end } },
              { endTime: { gt: start } },
            ],
          },
        });

        if (conflictingBooking) {
          throw new ConflictException('Já existe um agendamento para este horário nesta quadra.');
        }

        return tx.booking.create({
          data: {
            courtId: court.id,
            arenaId: court.arenaId, // Garante arenaId legítimo da quadra
            userId: targetUserId,
            customerName: !targetUserId ? dto.customerName : null,
            startTime: start,
            endTime: end,
            totalAmount: calculatedTotal, // Calculado estritamente pelo backend
            status: BookingStatus.CONFIRMED,
          },
          include: {
            court: { select: { id: true, name: true, sport: true } },
            arena: { select: { id: true, name: true } },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(user: any, filter: BookingFilterDto) {

    const whereClause: any = {};

    // 1. Se for ATHLETE, visualiza apenas suas próprias reservas
    if (user.role === Role.ATHLETE) {
        whereClause.userId = user.id;
    } 
    
    // 2. Se for ARENA_ADMIN, filtra pelas arenas que ele gerencia
    else if (user.role === Role.ARENA_ADMIN) {
        // Busca o usuário atualizado com as arenas que ele tem permissão
        const currentUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { arenasManaged: { select: { id: true } } },
        });

        const managedArenaIds = currentUser?.arenasManaged.map((a) => a.id) || [];

        // Se o front enviar um arenaId específico no filtro, valida se o admin gerencia ela
        if (filter.arenaId) {
        if (!managedArenaIds.includes(filter.arenaId)) {
            throw new ForbiddenException('Você não tem permissão para visualizar os agendamentos desta arena.');
        }
        whereClause.arenaId = filter.arenaId;
        } else {
        // Se não enviou filtro, pega a arena ativa ou filtra por todas as arenas gerenciadas por ele
        const targetArenaId = filter.arenaId || user.activeArenaId;
        console.log('ARENA_ADMIN - Arena ativa do usuário:', targetArenaId);
        
        if (targetArenaId) {
            whereClause.arenaId = targetArenaId;
        } else {
            whereClause.arenaId = { in: managedArenaIds };
        }
        }
    } 
    
    // 3. Se for SUPERADMIN, pode filtrar por qualquer arena enviada no DTO
    else if (user.role === Role.SUPERADMIN && filter.arenaId) {
        whereClause.arenaId = filter.arenaId;
    }

    // 4. Filtro opcional por Quadra específica (se fornecido no DTO)
    if (filter.courtId) {
        whereClause.courtId = filter.courtId;
    }

    const data = await this.prisma.booking.findMany({
        where: whereClause,
        include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        court: { select: { id: true, name: true, sport: true } },
        arena: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'asc' },
    });

    return data;
    }

  async cancel(bookingId: string, user: any) {
    const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
    });

    if (!booking) {
        throw new NotFoundException('Agendamento não encontrado.');
    }

    // 1. O próprio atleta dono da reserva pode cancelar
    const isOwner = booking.userId === user.id;

    // 2. Busca as arenas que o usuário gerencia ou onde trabalha
    const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
        arenasManaged: { select: { id: true } },
        arenasEmployed: { select: { id: true } },
        },
    });

    const managedArenaIds = [
        ...(dbUser?.arenasManaged.map((a) => a.id) || []),
        ...(dbUser?.arenasEmployed.map((a) => a.id) || []),
    ];

    const isArenaStaffOrAdmin = managedArenaIds.includes(booking.arenaId);
    const isSuperAdmin = user.role === Role.SUPERADMIN;

    if (!isOwner && !isArenaStaffOrAdmin && !isSuperAdmin) {
        throw new ForbiddenException('Você não tem permissão para cancelar esta reserva.');
    }

    return this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
    });
    }
}