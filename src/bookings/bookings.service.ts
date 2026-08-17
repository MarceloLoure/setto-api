import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { BookingType, ParticipantStatus, Prisma } from '@prisma/client';
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

    // 1. Validações Temporais Básicas
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

    try {
      // 2. Transação Serializável para Prevenir Overbooking
      return await this.prisma.$transaction(
        async (tx) => {
          // Busca a quadra com arena, horários semanais e bloqueios de data
          const targetDateOnly = new Date(start);
          targetDateOnly.setUTCHours(0, 0, 0, 0);

          const dayOfWeek = start.getUTCDay();

          const court = await tx.court.findUnique({
            where: { id: dto.courtId },
            include: {
              arena: {
                include: {
                  admins: { select: { id: true } },
                  staff: { select: { id: true } },
                  operatingHours: {
                    where: { dayOfWeek },
                  },
                  holidays: {
                    where: { date: targetDateOnly },
                  },
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

          // 3. Validação de Feriado / Data Bloqueada
          if (court.arena.holidays.length > 0) {
            const holiday = court.arena.holidays[0];
            throw new BadRequestException(
              `A arena não aceita agendamentos nesta data (${holiday.description || 'Feriado/Fechado'}).`,
            );
          }

          // 4. Validação de Dia da Semana e Janela de Horário
          const schedule = court.arena.operatingHours[0];
          if (schedule && !schedule.isOpen) {
            throw new BadRequestException('A arena não abre neste dia da semana.');
          }

          const openTimeStr = schedule?.openTime || '06:00';
          const closeTimeStr = schedule?.closeTime || '23:00';

          const [openHour, openMin] = openTimeStr.split(':').map(Number);
          const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);

          const scheduleOpen = new Date(start);
          scheduleOpen.setUTCHours(openHour, openMin, 0, 0);

          const scheduleClose = new Date(start);
          scheduleClose.setUTCHours(closeHour, closeMin, 0, 0);

          if (start < scheduleOpen || end > scheduleClose) {
            throw new BadRequestException(
              `Horário fora do funcionamento da arena (${openTimeStr} às ${closeTimeStr}).`,
            );
          }

          // 5. Controle de Impersonação (Balcão vs Atleta)
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

          // 6. Cálculo Imutável de Preço no Backend
          const hourlyRate = Number(court.hourlyRate);
          const calculatedTotal = Number((durationInHours * hourlyRate).toFixed(2));

          // 7. Checagem de Conflito de Horário (CONFIRMED e PENDING)
          const conflictingBooking = await tx.booking.findFirst({
            where: {
              courtId: court.id,
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESERVED_LOCAL, BookingStatus.PENDING, BookingStatus.COMPLETED] },
              AND: [
                { startTime: { lt: end } },
                { endTime: { gt: start } },
              ],
            },
          });

          if (conflictingBooking) {
            throw new ConflictException('Já existe um agendamento para este horário nesta quadra.');
          }

          // 8. Criação do Agendamento
          return tx.booking.create({
            data: {
              courtId: court.id,
              arenaId: court.arenaId,
              userId: targetUserId,
              customerName: !targetUserId ? dto.customerName : null,
              startTime: start,
              endTime: end,
              totalAmount: calculatedTotal,
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
    } catch (error: any) {
      if (error?.code === 'P2034') {
        throw new ConflictException('Horário acabou de ser reservado por outro usuário.');
      }
      throw error;
    }
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

  async joinGroupLesson(bookingId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { participants: true },
      });

      if (!booking || booking.type !== BookingType.GROUP_LESSON) {
        throw new BadRequestException('Esta aula não aceita inscrições coletivas.');
      }

      if (booking.maxPlayers && booking.participants.length >= booking.maxPlayers) {
        throw new ConflictException('Todas as vagas para esta aula já foram preenchidas.');
      }

      return tx.bookingParticipant.create({
        data: {
          bookingId,
          userId,
          pricePaid: booking.pricePerPlayer || 0,
          status: ParticipantStatus.PENDING,
        },
      });
    });
  }

  async updateStatus(
    bookingId: string,
    user: any,
    newStatus: BookingStatus,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        arena: {
          include: { admins: { select: { id: true } }, staff: { select: { id: true } } },
        },
      },
    });

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');

    const isStaff =
      booking.arena.admins.some((a) => a.id === user.id) ||
      booking.arena.staff.some((s) => s.id === user.id) ||
      user.role === Role.SUPERADMIN;

    if (!isStaff) {
      throw new ForbiddenException('Apenas a equipe da arena pode alterar o status do agendamento.');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus },
    });
  }
}