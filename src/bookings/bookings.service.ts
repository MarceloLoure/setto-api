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

    // Transação com Isolamento Serializable para impedir double-booking por concorrência
    return this.prisma.$transaction(
        async (tx) => {
        // 1. Checa conflitos dentro do bloco transacional
        const conflictingBooking = await tx.booking.findFirst({
            where: {
            courtId: dto.courtId,
            status: BookingStatus.CONFIRMED,
            OR: [
                { startTime: { lte: start }, endTime: { gt: start } },
                { startTime: { lt: end }, endTime: { gte: end } },
                { startTime: { gte: start }, endTime: { lte: end } },
            ],
            },
        });

        if (conflictingBooking) {
            throw new ConflictException(
            'Este horário acabou de ser reservado por outro cliente.',
            );
        }

        // 2. Cria a reserva com garantia de bloqueio de linha
        return tx.booking.create({
            data: {
                startTime: start,
                endTime: end,
                totalAmount: dto.totalAmount,
                courtId: dto.courtId,
                arenaId: dto.arenaId,
                userId: dto.userId || null,
                customerName: dto.customerName || null,
                customerPhone: dto.customerPhone || null,
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