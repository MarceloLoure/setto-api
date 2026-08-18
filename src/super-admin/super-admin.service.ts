import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminPaginationQueryDto,
  FindUsersAdminQueryDto,
} from './dto/admin-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Dashboard Web: Métricas Gerais e Faturamento da Plataforma
  async getSystemOverview() {
    const [
      totalUsers,
      totalArenas,
      activeArenas,
      totalCourts,
      totalBookings,
      revenueAggregate,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.arena.count(),
      this.prisma.arena.count({ where: { isActive: true } }),
      this.prisma.court.count({ where: { isActive: true } }),
      this.prisma.booking.count(),
      this.prisma.booking.aggregate({
        where: { status: BookingStatus.CONFIRMED },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      metrics: {
        users: { total: totalUsers },
        arenas: { total: totalArenas, active: activeArenas },
        courts: { activeTotal: totalCourts },
        bookings: {
          total: totalBookings,
          grossVolume: Number(revenueAggregate._sum.totalAmount || 0),
        },
      },
    };
  }

  // 2. Painel de Usuários com Paginação e Busca
  async getAllUsers(query: FindUsersAdminQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { cpf: { contains: query.search.replace(/\D/g, '') } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
          role: true,
          avatar: true,
          city: true,
          state: true,
          activeArenaId: true,
          arenasManaged: { select: { id: true, name: true } },
          arenasEmployed: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 3. Moderação de Arenas com Contadores e Donos
  async getAllArenas(query: AdminPaginationQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ArenaWhereInput = {
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { cnpj: { contains: query.search.replace(/\D/g, '') } },
          { city: { contains: query.search, mode: 'insensitive' } },
          { state: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, arenas] = await Promise.all([
      this.prisma.arena.count({ where }),
      this.prisma.arena.findMany({
        where,
        skip,
        take: limit,
        include: {
          admins: {
            select: { id: true, name: true, email: true, phone: true },
          },
          _count: {
            select: {
              courts: true,
              bookings: true,
              followers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: arenas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 4. Alterar Role e Vínculo de Arena
  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updateData: Prisma.UserUpdateInput = {
      role: dto.role,
    };

    if (dto.arenaId) {
      updateData.activeArenaId = dto.arenaId;
      updateData.arenasManaged = {
        connect: { id: dto.arenaId },
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        activeArenaId: true,
        arenasManaged: { select: { id: true, name: true } },
      },
    });

    return {
      message: 'Permissões do usuário atualizadas com sucesso.',
      user: updatedUser,
    };
  }

  // 5. Histórico Global de Agendamentos / Auditoria Financeira
  async getAllBookings(query: AdminPaginationQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, bookings] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          arena: { select: { id: true, name: true } },
          court: { select: { id: true, name: true, sport: true } },
          payment: { select: { id: true, status: true, method: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 6. Deletar Usuário (Ação Destrutiva Master)
  async deleteUser(userId: string, currentSuperAdminId: string) {
    if (userId === currentSuperAdminId) {
      throw new BadRequestException('Você não pode excluir sua própria conta de SuperAdmin.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: `Usuário ${user.name} removido permanentemente do sistema.` };
  }
}