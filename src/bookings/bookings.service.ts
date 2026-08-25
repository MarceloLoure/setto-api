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
import { CreateAppBookingDto } from './dto/create-app-booking.dto';
import { ManagerBookingFilterDto } from './dto/manager-booking-filter.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  
  // -------------------------------------------------------------
  // 1. FLUXO DO APP MOBILE (Atleta - Sem trava de impersonação)
  // -------------------------------------------------------------
  async createAppBooking(user: any, dto: CreateAppBookingDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const now = new Date();

    this.validateTimeWindow(start, end, now);

    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const court = await this.fetchAndValidateCourtAvailability(tx, dto.courtId, start, end);

          const hourlyRate = Number(court.hourlyRate);
          const calculatedTotal = Number((durationInHours * hourlyRate).toFixed(2));

          return tx.booking.create({
            data: {
              type: BookingType.FREE_PLAY,
              courtId: court.id,
              arenaId: court.arenaId,
              userId: user.id,
              customerName: null,
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
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
    } catch (error: any) {
      this.handlePrismaConflictError(error);
    }
  }

  // -------------------------------------------------------------
  // 2. FLUXO DO PAINEL WEB / MANAGER (Admin, Staff e Professores)
  // -------------------------------------------------------------
  async createAdminBooking(user: any, dto: CreateBookingDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const now = new Date();

    this.validateTimeWindow(start, end, now);

    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const court = await this.fetchAndValidateCourtAvailability(tx, dto.courtId, start, end);

          // Validação de permissão do Staff na Arena
          const isArenaStaff =
            court.arena.admins.some((a) => a.id === user.id) ||
            court.arena.staff.some((s) => s.id === user.id) ||
            user.role === Role.SUPERADMIN;

          if (!isArenaStaff) {
            throw new ForbiddenException('Apenas a equipe da arena pode acessar o módulo de gestão.');
          }

          const targetUserId = dto.userId || null;
          const hourlyRate = Number(court.hourlyRate);
          const calculatedTotal = Number((durationInHours * hourlyRate).toFixed(2));

          // Criação da reserva principal
          const newBooking = await tx.booking.create({
            data: {
              type: dto.type || BookingType.FREE_PLAY,
              courtId: court.id,
              arenaId: court.arenaId,
              userId: targetUserId,
              customerName: !targetUserId ? dto.customerName : null,
              coachId: dto.coachId || null,
              pricePerPlayer: dto.pricePerPlayer || null,
              maxPlayers: dto.maxPlayers || null,
              tournamentName: dto.tournamentName || null,
              isRecurring: dto.isRecurring || false,
              recurrenceEnd: dto.recurrenceEnd ? new Date(dto.recurrenceEnd) : null,
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

          // Inclusão de participantes iniciais (se fornecidos)
          if (dto.participantIds && dto.participantIds.length > 0) {
            await tx.bookingParticipant.createMany({
              data: dto.participantIds.map((pId) => ({
                bookingId: newBooking.id,
                userId: pId,
                pricePaid: dto.pricePerPlayer || 0,
                status: ParticipantStatus.CONFIRMED,
              })),
            });
          }

          return newBooking;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
    } catch (error: any) {
      this.handlePrismaConflictError(error);
    }
  }

  // -------------------------------------------------------------
  // MÉTODOS AUXILIARES DE SUPORTE
  // -------------------------------------------------------------
  private validateTimeWindow(start: Date, end: Date, now: Date) {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Formato de data inválido.');
    }
    if (start >= end) {
      throw new BadRequestException('O horário de início deve ser anterior ao de término.');
    }
    if (start < now) {
      throw new BadRequestException('Não é possível criar agendamentos no passado.');
    }
    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationInHours < 0.5) {
      throw new BadRequestException('O tempo mínimo de agendamento é de 30 minutos.');
    }
  }

  private async fetchAndValidateCourtAvailability(tx: any, courtId: string, start: Date, end: Date) {
    const targetDateOnly = new Date(start);
    targetDateOnly.setUTCHours(0, 0, 0, 0);
    const dayOfWeek = start.getUTCDay();

    const court = await tx.court.findUnique({
      where: { id: courtId },
      include: {
        arena: {
          include: {
            admins: { select: { id: true } },
            staff: { select: { id: true } },
            operatingHours: { where: { dayOfWeek } },
            holidays: { where: { date: targetDateOnly } },
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

    if (court.arena.holidays.length > 0) {
      const holiday = court.arena.holidays[0];
      throw new BadRequestException(`Arena fechada nesta data (${holiday.description || 'Feriado'}).`);
    }

    const schedule = court.arena.operatingHours[0];
    if (schedule && !schedule.isOpen) {
      throw new BadRequestException('A arena não abre neste dia da semana.');
    }

    const openTimeStr = schedule?.openTime || '06:00';
    const closeTimeStr = schedule?.closeTime || '23:00';
    const [openH, openM] = openTimeStr.split(':').map(Number);
    const [closeH, closeM] = closeTimeStr.split(':').map(Number);

    const scheduleOpen = new Date(start);
    scheduleOpen.setUTCHours(openH, openM, 0, 0);

    const scheduleClose = new Date(start);
    scheduleClose.setUTCHours(closeH, closeM, 0, 0);

    if (start < scheduleOpen || end > scheduleClose) {
      throw new BadRequestException(`Horário fora de funcionamento (${openTimeStr} às ${closeTimeStr}).`);
    }

    const conflictingBooking = await tx.booking.findFirst({
      where: {
        courtId: court.id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESERVED_LOCAL, BookingStatus.PENDING] },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    });

    if (conflictingBooking) {
      throw new ConflictException('Já existe um agendamento para este horário nesta quadra.');
    }

    return court;
  }

  private handlePrismaConflictError(error: any) {
    if (error?.code === 'P2034') {
      throw new ConflictException('Horário acabou de ser reservado por outro usuário.');
    }
    if (error?.code === 'P2028') {
      throw new ConflictException('O sistema está com alta demanda no momento. Tente novamente.');
    }
    throw error;
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

  async findManagerBookings(user: any, filter: ManagerBookingFilterDto) {
    const whereClause: Prisma.BookingWhereInput = {};

    // 1. Controle de Acesso por Perfil
    if (user.role === Role.ARENA_ADMIN || user.role === Role.RECEPTIONIST || user.role === Role.TEACHER) {
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

      if (filter.arenaId) {
        if (!allowedArenaIds.includes(filter.arenaId)) {
          throw new ForbiddenException('Você não tem permissão para acessar os agendamentos desta arena.');
        }
        whereClause.arenaId = filter.arenaId;
      } else {
        whereClause.arenaId = { in: allowedArenaIds };
      }
    } else if (user.role === Role.SUPERADMIN) {
      if (filter.arenaId) whereClause.arenaId = filter.arenaId;
    } else {
      throw new ForbiddenException('Acesso restrito à gestão de arenas.');
    }

    // 2. Filtros de Quadra, Status e Tipo
    if (filter.courtId) whereClause.courtId = filter.courtId;
    if (filter.status) whereClause.status = filter.status;
    if (filter.type) whereClause.type = filter.type;

    // 3. Filtro por Janela de Tempo (FullCalendar Range)
    if (filter.startDate || filter.endDate) {
      whereClause.AND = [];
      if (filter.startDate) {
        whereClause.AND.push({ startTime: { gte: new Date(filter.startDate) } });
      }
      if (filter.endDate) {
        whereClause.AND.push({ endTime: { lte: new Date(filter.endDate) } });
      }
    }

    // 4. Busca com relacionamentos
    const bookings = await this.prisma.booking.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            sport: true,
            hourlyRate: true,
            isCovered: true,
          },
        },
        arena: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        participants: {
          select: {
            id: true,
            status: true,
            pricePaid: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Formatação de conveniência para a grade web
    return bookings.map((b) => {
      const isGuest = !b.user;
      const clientDisplayName = isGuest ? b.customerName || 'Cliente Balcão' : b.user?.name;
      const clientPhone = isGuest ? null : b.user?.phone;
      const clientEmail = isGuest ? null : b.user?.email;

      return {
        ...b,
        clientDisplayName,
        clientPhone,
        clientEmail,
        isGuestBooking: isGuest,
        confirmedParticipantsCount: b.participants?.length || 0,
      };
    });
  }
}