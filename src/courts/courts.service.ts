import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { Role } from '@prisma/client';

@Injectable()
export class CourtsService {
  constructor(private prisma: PrismaService) {}

  // 1. Criar Quadra (Com suporte a múltiplas arenas do mesmo dono)
  async create(user: any, dto: CreateCourtDto) {
    // Busca o usuário atualizado com todas as arenas que ele gerencia
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { arenasManaged: { select: { id: true } } },
    });

    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    const managedArenaIds = dbUser.arenasManaged.map((a) => a.id);

    // Define qual arena receberá a quadra
    let targetArenaId = dto.arenaId || dbUser.activeArenaId || managedArenaIds[0];

    if (!targetArenaId) {
      throw new BadRequestException('User is not associated with any Arena');
    }

    // Se NÃO for SUPERADMIN, valida se a arena informada realmente pertence ao usuário
    if (user.role !== Role.SUPERADMIN) {
      if (!managedArenaIds.includes(targetArenaId)) {
        throw new ForbiddenException(
          'You do not have permission to add courts to this arena',
        );
      }
    }

    // Verifica se a arena realmente existe no banco
    const arena = await this.prisma.arena.findUnique({
      where: { id: targetArenaId },
    });

    if (!arena) {
      throw new NotFoundException('Arena not found');
    }

    return this.prisma.court.create({
      data: {
        name: dto.name,
        sport: dto.sport,
        hourlyRate: dto.hourlyRate,
        isCovered: dto.isCovered ?? false,
        arenaId: targetArenaId,
      },
    });
  }

  // 2. Lista Quadras de uma Arena Específica
  async findByArena(arenaId: string) {
    return this.prisma.court.findMany({
      where: { arenaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Atualizar Quadra (Valida se a quadra pertence a QUALQUER uma das arenas do dono)
  async update(courtId: string, user: any, dto: UpdateCourtDto) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
    });

    if (!court) {
      throw new NotFoundException('Court not found');
    }

    if (user.role !== Role.SUPERADMIN) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { arenasManaged: { select: { id: true } } },
      });

      const managedArenaIds = dbUser?.arenasManaged.map((a) => a.id) || [];

      if (!managedArenaIds.includes(court.arenaId)) {
        throw new ForbiddenException(
          'You can only manage courts from your own arenas',
        );
      }
    }

    return this.prisma.court.update({
      where: { id: courtId },
      data: dto,
    });
  }

  // 4. Remover Quadra
  async remove(courtId: string, user: any) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
    });

    if (!court) {
      throw new NotFoundException('Court not found');
    }

    if (user.role !== Role.SUPERADMIN) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { arenasManaged: { select: { id: true } } },
      });

      const managedArenaIds = dbUser?.arenasManaged.map((a) => a.id) || [];

      if (!managedArenaIds.includes(court.arenaId)) {
        throw new ForbiddenException(
          'You can only remove courts from your own arenas',
        );
      }
    }

    await this.prisma.court.delete({
      where: { id: courtId },
    });

    return { message: 'Court deleted successfully' };
  }
}