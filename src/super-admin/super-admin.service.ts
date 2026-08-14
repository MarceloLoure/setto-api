import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  // 1. Visão Geral da Plataforma (Dashboard Metrics)
  async getSystemOverview() {
    const [totalUsers, totalArenas, totalCourts, totalBookings] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.arena.count(),
      this.prisma.court.count(),
      this.prisma.booking.count(),
    ]);

    return {
      metrics: {
        totalUsers,
        totalArenas,
        totalCourts,
        totalBookings,
      },
    };
  }

  // 2. Listar Todos os Usuários
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        btRating: true,
        footvolleyElo: true,
        activeArenaId: true,
        arenasManaged: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Alterar Role/Arena de Qualquer Usuário
  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Se um arenaId for informado no DTO, conecta o usuário a essa arena na relação N:N
    const updateData: any = {
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
        avatarUrl: true,
        activeArenaId: true,
        arenasManaged: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      message: 'User role updated successfully',
      user: updatedUser,
    };
  }

  // 4. Listar Todas as Arenas Cadastradas
  async getAllArenas() {
    return this.prisma.arena.findMany({
      include: {
        courts: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            courts: true,
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 5. Listar Todas as Quadras do Sistema
  async getAllCourts() {
    return this.prisma.court.findMany({
      include: {
        arena: {
          select: {
            name: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 6. Listar Todos os Agendamentos/Reservas da Plataforma
  async getAllBookings() {
    return this.prisma.booking.findMany({
      include: {
        user: {
          select: { name: true, email: true },
        },
        arena: {
          select: { name: true },
        },
        court: {
          select: { name: true, sport: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 7. Deletar Usuário (Ação de Limpeza Master)
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: `User ${userId} deleted successfully` };
  }
}