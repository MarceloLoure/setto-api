import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException
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

const MAX_FIXED_FEE = 5.0;

export function calculateServiceFee(
  hourlyRate: number,
  durationInHours: number,
  platformFeePercent: number,
) {
  // 1. O valor total pago pelo cliente é o valor bruto estipulado pela arena
  const totalPrice = hourlyRate * durationInHours;

  // 2. A taxa da plataforma é a porcentagem descontada do valor total
  const serviceFee = Number(((totalPrice * platformFeePercent) / 100).toFixed(2));

  // 3. O valor líquido que vai para a arena é o total menos a comissão
  const courtBasePrice = Number((totalPrice - serviceFee).toFixed(2));

  return {
    totalPrice,      // Valor cobrado do cliente (bruto)
    serviceFee,      // Comissão descontada para a plataforma
    courtBasePrice,  // Repasse líquido enviado no split da wallet da arena
  };
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {}

  // -------------------------------------------------------------
  // 1. FLUXO DO APP MOBILE (Atleta - Sem trava de impersonação)
  // -------------------------------------------------------------
 async createAppBooking(user: any, dto: CreateAppBookingDto, clientIp: string) {
  const start = parseAppMobileTimestamp(dto.startTime);
  const end = parseAppMobileTimestamp(dto.endTime);
  const now = new Date();

  // 1. Valida janela de horário
  this.validateTimeWindow(start, end, now);

  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  // 2. Valida CPF e carrega cartões cadastrados
  const fullUser = await this.prisma.user.findUnique({
    where: { id: user.id },
    include: { creditCards: true },
  });

  if (!fullUser?.cpf) {
    throw new BadRequestException(
      'Você precisa cadastrar seu CPF no perfil para realizar o pagamento de reservas.',
    );
  }

  // 3. Sincroniza Customer no Asaas (fora da transação principal)
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
      // Ignora erro de busca
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

  // PASSOS 4 & 5: Isolamento de Transação + Comunicação Externa Segura

  let bookingResult: any;

  // PASSO 4: Transação ultra-rápida no banco (Reserva a quadra e cria o registro PENDING)
  try {
    bookingResult = await this.prisma.$transaction(
      async (tx) => {
        const court = await this.fetchAndValidateCourtAvailability(tx, dto.courtId, start, end);

        const durationInMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        const durationInHours = durationInMinutes / 60;
        const hourlyRate = Number(court.hourlyRate);

        const platformFeePercent = Number(court.arena.platformFeePercent ?? 5);
        const { courtBasePrice, serviceFee, totalPrice } = calculateServiceFee(
          hourlyRate,
          durationInHours,
          platformFeePercent,
        );

        const newBooking = await tx.booking.create({
          data: {
            type: BookingType.FREE_PLAY,
            courtId: court.id,
            arenaId: court.arenaId,
            userId: user.id,
            startTime: start,
            endTime: end,
            totalAmount: totalPrice,
            status: BookingStatus.PENDING,
            expiresAt: expiresAt,
          },
          include: {
            arena: true,
            court: { select: { id: true, name: true, sport: true } },
          },
        });

        const localPayment = await tx.payment.create({
          data: {
            description: `Reserva ${newBooking.id} — ${newBooking.arena.name}`,
            amount: totalPrice,
            method: dto.billingType === 'PIX' ? PaymentMethod.PIX : PaymentMethod.CREDIT_CARD,
            category: PaymentCategory.BOOKING,
            status: PaymentStatus.PENDING,
            arenaId: newBooking.arenaId,
            bookingId: newBooking.id,
            userId: newBooking.userId,
            createdById: user.id,
            expiresAt: expiresAt,
          },
        });

        return {
          newBooking,
          localPayment,
          courtBasePrice,
          serviceFee,
          totalPrice,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 3_000,
        timeout: 5_000,
      },
    );
  } catch (error) {
    this.handlePrismaConflictError(error);
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      throw error;
    }
    throw new BadRequestException('Não foi possível verificar a disponibilidade da quadra.');
  }

  const { newBooking, localPayment, courtBasePrice, serviceFee, totalPrice } = bookingResult;

  // PASSO 5: Chamada Externa ao Asaas (Fora de qualquer transação de banco)
  let asaasPayment: any;
  try {
    const arenaWalletId = newBooking.arena.asaasWalletId!;
    const dueDate = new Date().toISOString().slice(0, 10);

    const paymentPayload: any = {
      customer: asaasCustomerId!,
      billingType: dto.billingType,
      value: totalPrice,
      dueDate,
      description: `Reserva ${newBooking.id} — ${newBooking.arena.name}`,
      externalReference: `booking:${newBooking.id}`,
      split: [
        {
          walletId: arenaWalletId,
          fixedValue: courtBasePrice,
        },
      ],
    };

    if (dto.billingType === 'CREDIT_CARD') {
      // 1. INJEÇÃO DO REMOTE IP
      paymentPayload.remoteIp = clientIp;

      if (dto.cardId) {
        const savedCard = fullUser.creditCards.find((c) => c.id === dto.cardId);
        if (!savedCard) {
          throw new BadRequestException('Cartão de crédito informado não encontrado.');
        }
        paymentPayload.creditCardToken = savedCard.asaasToken;
      } else if (dto.creditCardToken) {
        paymentPayload.creditCardToken = dto.creditCardToken;
      } else {
        paymentPayload.creditCard = dto.creditCard;
        paymentPayload.creditCardHolderInfo = dto.creditCardHolderInfo;
      }
    }

    // Chamada remota
    asaasPayment = await this.asaasService.createSplitPayment(paymentPayload);
  } catch (error) {
    // SE O ASAAS FALHAR: Cancela o booking e o payment para liberar a quadra imediatamente
    await this.prisma.booking.update({
      where: { id: newBooking.id },
      data: { status: BookingStatus.CANCELLED },
    });
    await this.prisma.payment.update({
      where: { id: localPayment.id },
      data: { status: PaymentStatus.CANCELLED },
    });

    console.error('Erro na criação de cobrança no Asaas:', error);
    throw new BadRequestException(
      error?.response?.data?.errors?.[0]?.description ||
        'Não foi possível processar a cobrança junto ao provedor de pagamento.',
    );
  }

  // PASSO 6: Atualiza banco com a resposta obtida do Asaas
  let pixCopiaECola: string | undefined = undefined;
  let paymentDetails: any = {
    asaasPaymentId: asaasPayment.id,
    billingType: dto.billingType,
    status: asaasPayment.status,
    courtBasePrice,
    serviceFee,
    totalPrice,
  };

  let finalBookingStatus: BookingStatus = BookingStatus.PENDING;
  let finalPaymentStatus: PaymentStatus = PaymentStatus.PENDING;

  if (dto.billingType === 'PIX') {
    const qrCode = await this.asaasService.getPixQrCode(asaasPayment.id);
    pixCopiaECola = qrCode.payload;
    paymentDetails.pix = qrCode;
  } else if (dto.billingType === 'CREDIT_CARD') {
    const token = asaasPayment.creditCard?.creditCardToken;
    paymentDetails.creditCardToken = token;

    if (dto.saveCard && token && !dto.cardId && !dto.creditCardToken) {
      const existingCount = fullUser.creditCards.length;

      await this.prisma.creditCard.upsert({
        where: { asaasToken: token },
        update: {
          holderName: dto.creditCardHolderInfo?.name || fullUser.name,
          expiryMonth: dto.creditCard?.expiryMonth || '',
          expiryYear: dto.creditCard?.expiryYear || '',
        },
        create: {
          userId: user.id,
          asaasToken: token,
          brand: asaasPayment.creditCard?.creditCardBrand || 'UNKNOWN',
          lastFourDigits:
            asaasPayment.creditCard?.creditCardNumber ||
            dto.creditCard?.number.slice(-4) ||
            '0000',
          holderName: dto.creditCardHolderInfo?.name || fullUser.name,
          expiryMonth: dto.creditCard?.expiryMonth || '',
          expiryYear: dto.creditCard?.expiryYear || '',
          isDefault: existingCount === 0,
        },
      });
    }

    if (asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'RECEIVED') {
      finalPaymentStatus = PaymentStatus.COMPLETED;
      finalBookingStatus = BookingStatus.CONFIRMED;
    }
  }

  // Persiste status finais no banco
  await this.prisma.payment.update({
    where: { id: localPayment.id },
    data: {
      asaasPaymentId: asaasPayment.id,
      pixCopiaECola: pixCopiaECola,
      status: finalPaymentStatus,
      ...(finalPaymentStatus === PaymentStatus.COMPLETED ? { paidAt: new Date() } : {}),
    },
  });

  if (finalBookingStatus === BookingStatus.CONFIRMED) {
    await this.prisma.booking.update({
      where: { id: newBooking.id },
      data: { status: BookingStatus.CONFIRMED },
    });
    newBooking.status = BookingStatus.CONFIRMED;
  }

  return {
    booking: newBooking,
    payment: paymentDetails,
    expiresAt: expiresAt.toISOString(),
  };
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

    let pixCopiaECola: string | undefined = undefined;
    let responsePayload: any = { asaasPaymentId: asaasPayment.id, billingType: dto.billingType };

    if (dto.billingType === 'PIX') {
      const qrCode = await this.asaasService.getPixQrCode(asaasPayment.id);
      pixCopiaECola = qrCode.payload;
      responsePayload.pix = qrCode;
    } else {
      responsePayload.invoiceUrl = asaasPayment.invoiceUrl;
    }

    await this.prisma.payment.update({
      where: { id: localPayment.id },
      data: { 
        asaasPaymentId: asaasPayment.id,
        pixCopiaECola: pixCopiaECola,
        expiresAt: booking.expiresAt,
      }
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
    // 1. O horário de início deve ser anterior ao de término
    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException('O horário final deve ser maior que o horário inicial.');
    }

    // 2. Compara o instante UTC diretamente em milissegundos (tolerância de 1 minuto)
    const marginInMs = 60 * 1000;
    if (start.getTime() < now.getTime() - marginInMs) {
      throw new BadRequestException('Não é possível agendar em um horário no passado.');
    }
  }

  private async fetchAndValidateCourtAvailability(tx: any, courtId: string, start: Date, end: Date) {
    // 1. Extrai a data local (Ano, Mês, Dia) no fuso de Brasília
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(start);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    const localStartDateStr = `${year}-${month}-${day}`;
    const localStartDate = new Date(`${localStartDateStr}T00:00:00-03:00`);
    const dayOfWeek = localStartDate.getDay();

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

    // Converte "HH:mm" do horário de Brasília diretamente para o instante UTC
    const scheduleOpen = new Date(`${localStartDateStr}T${openTimeStr}:00-03:00`);
    const scheduleClose = new Date(`${localStartDateStr}T${closeTimeStr}:00-03:00`);

    if (scheduleClose <= scheduleOpen) {
      scheduleClose.setDate(scheduleClose.getDate() + 1);
    }

    // ------------------- LOGS DE DIAGNÓSTICO -------------------
    console.log('\n================ [ VALIDAÇÃO DE HORÁRIO ] ================');
    console.log('📌 Recebido da requisição (UTC Raw):', {
      startUTC: start.toISOString(),
      endUTC: end.toISOString(),
    });

    console.log('🕒 Recebido convertido para Horário de Brasília (BRT):', {
      inicioRequisitado: start.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      fimRequisitado: end.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });

    console.log('🏢 Horário de funcionamento cadastrado na Arena (BRT):', {
      aberturaConfigurada: openTimeStr,
      fechamentoConfigurado: closeTimeStr,
      aberturaUTC: scheduleOpen.toISOString(),
      fechamentoUTC: scheduleClose.toISOString(),
    });

    console.log('⚖️ Comparação final (Validação):', {
      inicioEValido: start >= scheduleOpen,
      fimEValido: end <= scheduleClose,
    });
    console.log('===========================================================\n');
    // -----------------------------------------------------------

    if (start < scheduleOpen || end > scheduleClose) {
      throw new BadRequestException(
        `Horário fora de funcionamento (${openTimeStr} às ${closeTimeStr}, horário de Brasília).`,
      );
    }

    // Validação de conflito com outros agendamentos
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

    if (filter.date) {
      const startOfDay = new Date(`${filter.date}T00:00:00-03:00`);
      const endOfDay = new Date(`${filter.date}T23:59:59.999-03:00`);

      whereClause.AND = [
        { startTime: { lt: endOfDay } },
        { endTime: { gt: startOfDay } },
      ];
    }

    return this.prisma.booking.findMany({
      where: whereClause,
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
          },
        },
        arena: {
          select: {
            id: true,
            name: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

    // 2. Consulta de ocupação pública para o App
  async getAthleteCourtAvailability(filter: BookingFilterDto) {
    // 1. Cláusula de busca para as reservas ativas
    const whereClause: Prisma.BookingWhereInput = {
      status: {
        in: [BookingStatus.CONFIRMED, BookingStatus.RESERVED_LOCAL, BookingStatus.PENDING],
      },
    };

    if (filter.courtId) {
      whereClause.courtId = filter.courtId;
    } else if (filter.arenaId) {
      whereClause.arenaId = filter.arenaId;
    }

    if (filter.date) {
      const startOfDay = new Date(`${filter.date}T00:00:00-03:00`);
      const endOfDay = new Date(`${filter.date}T23:59:59.999-03:00`);

      whereClause.AND = [
        { startTime: { lt: endOfDay } },
        { endTime: { gt: startOfDay } },
      ];
    }

    // 2. Busca paralela: reservas ocupadas + dados de funcionamento da arena/quadra
    const [existingBookings, courtOrArenaData] = await Promise.all([
      this.prisma.booking.findMany({
        where: whereClause,
        select: {
          id: true,
          courtId: true,
          startTime: true,
          endTime: true,
          status: true,
        },
        orderBy: { startTime: 'asc' },
      }),

      // Traz os horários de funcionamento (openingHours) da Arena e da Quadra
      filter.courtId
        ? this.prisma.court.findUnique({
            where: { id: filter.courtId },
            select: {
              id: true,
              name: true,
              hourlyRate: true,
              arena: {
                select: {
                  id: true,
                  name: true,
                  holidays: true,
                  operatingHours: true,
                },
              },
            },
          })
        : filter.arenaId
        ? this.prisma.arena.findUnique({
            where: { id: filter.arenaId },
            select: {
              id: true,
              name: true,
              operatingHours: true,
              holidays: true,
              platformFeePercent: true,
              courts: {
                select: {
                  id: true,
                  name: true,
                  hourlyRate: true,
                  isActive: true,
                },
              },
            },
          })
        : null,
    ]);

    return {
      operatingRules: courtOrArenaData,
      occupiedSlots: existingBookings,
    };
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
            pixCopiaECola: true,
            expiresAt: true,
            asaasPaymentId: true,
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