import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { BookingType, ParticipantStatus, Prisma, PaymentCategory, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { BookingStatus, Role } from '@prisma/client';
import { CreateAppBookingDto } from './dto/create-app-booking.dto';
import { ManagerBookingFilterDto } from './dto/manager-booking-filter.dto';
import { CreateBookingCheckoutDto } from './dto/create-booking-checkout.dto';
import { AsaasService } from '../asaas/asaas.service';
import { brazilTimeToUtcDate, parseAppMobileTimestamp } from '../common/utils/timezone.util';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {}

  
  // -------------------------------------------------------------
  // 1. FLUXO DO APP MOBILE (Atleta - Sem trava de impersonação)
  // -------------------------------------------------------------
  async createAppBooking(user: any, dto: CreateAppBookingDto) {
    const start = parseAppMobileTimestamp(dto.startTime);
    const end = parseAppMobileTimestamp(dto.endTime);
    const now = new Date();

    // 1. OBRIGATÓRIO: Valida se as datas enviadas são válidas e futuras
    this.validateTimeWindow(start, end, now);

    // 2. Define a expiração para exatamente 30 minutos a partir de agora
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    // 3. Transação rápida de banco: valida vaga e cria a reserva com status PENDING + TTL
    let newBooking: any;
    let court: any;

    try {
      ({ newBooking, court } = await this.prisma.$transaction(
        async (tx) => {
          const court = await this.fetchAndValidateCourtAvailability(tx, dto.courtId, start, end);

          // Calcula a duração exata em minutos e converte para horas
          const durationInMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          const durationInHours = durationInMinutes / 60;

          const hourlyRate = Number(court.hourlyRate);
          const calculatedTotal = Number((durationInHours * hourlyRate).toFixed(2));

          const newBooking = await tx.booking.create({
            data: {
              type: BookingType.FREE_PLAY,
              courtId: court.id,
              arenaId: court.arenaId,
              userId: user.id,
              startTime: start,
              endTime: end,
              totalAmount: calculatedTotal,
              status: BookingStatus.PENDING,
              expiresAt: expiresAt,
            },
            include: {
              arena: true,
              court: { select: { id: true, name: true, sport: true } },
            },
          });

          return { newBooking, court };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 10_000,
        },
      ));
    } catch (error) {
      this.handlePrismaConflictError(error);
    }

    // 4. Valida CPF no perfil
    const fullUser = await this.prisma.user.findUnique({ where: { id: user.id } });

    if (!fullUser?.cpf) {
      await this.prisma.booking.delete({ where: { id: newBooking.id } }).catch(() => {});
      throw new BadRequestException(
        'Você precisa cadastrar seu CPF no perfil para realizar o pagamento de reservas.',
      );
    }

    // 5. Garante e Sincroniza Customer Asaas do Usuário
    let arenaWalletId = newBooking.arena.asaasWalletId;
    let asaasCustomerId = fullUser.asaasCustomerId;

    const customerData = {
      name: fullUser.name,
      email: fullUser.email,
      cpfCnpj: fullUser.cpf,
      phone: fullUser.phone || undefined,
      externalReference: fullUser.id,
    };

    if (!asaasCustomerId) {
      let existingCustomer: any = null;

      try {
        const searchByCpf = await this.asaasService.findCustomerByCpfCnpj(fullUser.cpf);
        if (searchByCpf?.data?.length > 0) {
          existingCustomer = searchByCpf.data[0];
        } else if (fullUser.email) {
          const searchByEmail = await this.asaasService.findCustomerByEmail(fullUser.email);
          if (searchByEmail?.data?.length > 0) {
            existingCustomer = searchByEmail.data[0];
          }
        }
      } catch (err) {
        // Ignora erro de busca e avança para criação
      }

      if (existingCustomer) {
        asaasCustomerId = existingCustomer.id;
        if (asaasCustomerId) {
          await this.asaasService.updateCustomer(asaasCustomerId, customerData).catch(() => {});
        }
      } else {
        const customer = await this.asaasService.createCustomer(customerData);
        asaasCustomerId = customer.id;
      }

      await this.prisma.user.update({
        where: { id: fullUser.id },
        data: { asaasCustomerId },
      });
    } else {
      await this.asaasService.updateCustomer(asaasCustomerId, customerData).catch(() => {});
    }

    // 6. Calcula splits (Plataforma vs Arena)
    const platformFeePercent = Number(newBooking.arena.platformFeePercent ?? 5);
    const arenaSharePercent = Number((100 - platformFeePercent).toFixed(2));
    const dueDate = new Date().toISOString().slice(0, 10);

    let localPayment: any = null;

    try {
      // 7. Cria registro de Payment local
      localPayment = await this.prisma.payment.create({
        data: {
          description: `Reserva ${newBooking.id} — ${newBooking.arena.name}`,
          amount: newBooking.totalAmount,
          method: dto.billingType === 'PIX' ? PaymentMethod.PIX : PaymentMethod.CREDIT_CARD,
          category: PaymentCategory.BOOKING,
          status: PaymentStatus.PENDING,
          arenaId: newBooking.arenaId,
          bookingId: newBooking.id,
          userId: newBooking.userId,
          createdById: user.id,
        },
      });

      // 8. Emite cobrança no Asaas
      const asaasPayment = await this.asaasService.createSplitPayment({
        customer: asaasCustomerId!,
        billingType: dto.billingType,
        value: Number(newBooking.totalAmount),
        dueDate,
        description: `Reserva ${newBooking.id} — ${newBooking.arena.name}`,
        externalReference: `booking:${newBooking.id}`,
        split: [{ walletId: arenaWalletId, percentualValue: arenaSharePercent }],
      });

      await this.prisma.payment.update({
        where: { id: localPayment.id },
        data: { asaasPaymentId: asaasPayment.id },
      });

      // 9. Retorna detalhes do pagamento
      let paymentDetails: any = { asaasPaymentId: asaasPayment.id, billingType: dto.billingType };
      if (dto.billingType === 'PIX') {
        const qrCode = await this.asaasService.getPixQrCode(asaasPayment.id);
        paymentDetails.pix = qrCode;
      } else {
        paymentDetails.invoiceUrl = asaasPayment.invoiceUrl;
      }

      return {
        booking: newBooking,
        payment: paymentDetails,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      // Rollback limpo: se o payment foi criado, deleta ele antes de deletar a booking
      if (localPayment?.id) {
        await this.prisma.payment.delete({ where: { id: localPayment.id } }).catch(() => {});
      }
      await this.prisma.booking.delete({ where: { id: newBooking.id } }).catch(() => {});
      throw error;
    }
  }

  // -------------------------------------------------------------
  // 1.1 CHECKOUT ONLINE (Pix/Cartão com split) — Vertical 1
  // -------------------------------------------------------------
  async initiateCheckout(user: any, bookingId: string, dto: CreateBookingCheckoutDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { arena: true, payment: true },
    });

    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    if (booking.userId !== user.id) {
      throw new ForbiddenException('Você só pode pagar reservas feitas por você.');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Esta reserva não está mais aguardando pagamento.');
    }
    if (booking.payment) {
      throw new BadRequestException('Esta reserva já possui um pagamento registrado.');
    }
    if (!booking.arena.asaasWalletId) {
      throw new BadRequestException('Esta arena ainda não está habilitada para receber pagamentos online.');
    }

    let asaasCustomerId = (await this.prisma.user.findUnique({ where: { id: user.id } }))?.asaasCustomerId;
    if (!asaasCustomerId) {
      const customer = await this.asaasService.createCustomer({
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpf || undefined,
        phone: user.phone || undefined,
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;
      await this.prisma.user.update({ where: { id: user.id }, data: { asaasCustomerId } });
    }

    if (!asaasCustomerId) {
      throw new BadRequestException('Não foi possível obter o cliente Asaas do usuário.');
    }

    const platformFeePercent = Number(booking.arena.platformFeePercent ?? 5);
    const arenaSharePercent = Number((100 - platformFeePercent).toFixed(2));

    let localPayment;
    try {
      localPayment = await this.prisma.payment.create({
        data: {
          description: `Reserva ${booking.id} — ${booking.arena.name}`,
          amount: booking.totalAmount,
          method: dto.billingType === 'PIX' ? PaymentMethod.PIX : PaymentMethod.CREDIT_CARD,
          category: PaymentCategory.BOOKING,
          status: PaymentStatus.PENDING,
          arenaId: booking.arenaId,
          bookingId: booking.id,
          userId: booking.userId,
          createdById: user.id,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Já existe uma cobrança em andamento para esta reserva.');
      }
      throw error;
    }

    const dueDate = new Date().toISOString().slice(0, 10);
    let asaasPayment;
    try {
      asaasPayment = await this.asaasService.createSplitPayment({
        customer: asaasCustomerId,
        billingType: dto.billingType,
        value: Number(booking.totalAmount),
        dueDate,
        description: `Reserva ${booking.id} — ${booking.arena.name}`,
        externalReference: `booking:${booking.id}`,
        split: [{ walletId: booking.arena.asaasWalletId, percentualValue: arenaSharePercent }],
      });
    } catch (error) {
      await this.prisma.payment.delete({ where: { id: localPayment.id } }).catch(() => {});
      throw error;
    }

    await this.prisma.payment.update({
      where: { id: localPayment.id },
      data: { asaasPaymentId: asaasPayment.id },
    });

    if (dto.billingType === 'PIX') {
      const qrCode = await this.asaasService.getPixQrCode(asaasPayment.id);
      return { asaasPaymentId: asaasPayment.id, billingType: dto.billingType, pix: qrCode };
    }

    return { asaasPaymentId: asaasPayment.id, billingType: dto.billingType, invoiceUrl: asaasPayment.invoiceUrl };
  }


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
              status: BookingStatus.PENDING,
            },
            include: {
              court: { select: { id: true, name: true, sport: true } },
              arena: { select: { id: true, name: true } },
            },
          });

          if (dto.participantIds && dto.participantIds.length > 0) {
            await tx.bookingParticipant.createMany({
              data: dto.participantIds.map((pId) => ({
                bookingId: newBooking.id,
                userId: pId,
                pricePaid: dto.pricePerPlayer || 0,
                status: ParticipantStatus.PENDING,
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
    // Extrai dia da semana e "dia calendário" no horário de Brasília — usar
    // toLocaleString + reparse (em vez de getUTCDay/setUTCHours direto em
    // `start`) evita erro perto da virada de dia: um `start` de madrugada em
    // UTC pode já ser o dia anterior em Brasília, e vice-versa.
    const localStartStr = start.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const localStartDate = new Date(localStartStr);
    const dayOfWeek = localStartDate.getDay();

    const year = localStartDate.getFullYear();
    const month = String(localStartDate.getMonth() + 1).padStart(2, '0');
    const day = String(localStartDate.getDate()).padStart(2, '0');
    const targetDateOnly = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

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

    // openTime/closeTime são cadastrados em horário local de Brasília pelo
    // dono da arena — precisam ser convertidos pra UTC antes de comparar
    // com `start`/`end`, que já chegam em UTC real.
    const scheduleOpen = brazilTimeToUtcDate(start, openTimeStr);
    const scheduleClose = brazilTimeToUtcDate(start, closeTimeStr);

    if (start < scheduleOpen || end > scheduleClose) {
      throw new BadRequestException(`Horário fora de funcionamento (${openTimeStr} às ${closeTimeStr}, horário de Brasília).`);
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
        payment: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            paidAt: true,
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
      const isPaid = !!b.payment;

      return {
        ...b,
        clientDisplayName,
        clientPhone,
        clientEmail,
        isGuestBooking: isGuest,
        isPaid,
        confirmedParticipantsCount: b.participants?.length || 0,
      };
    });
  }
}