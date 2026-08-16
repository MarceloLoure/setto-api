import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseStorageService } from '../storage/storage.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: FirebaseStorageService,
  ) {}

  // 1. Criar Quadra (Permite já enviar fotos no cadastro)
  async create(
    user: any,
    dto: CreateCourtDto,
    files?: Express.Multer.File[],
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { arenasManaged: { select: { id: true } } },
    });

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const managedArenaIds = dbUser.arenasManaged.map((a) => a.id);
    const targetArenaId = dto.arenaId || managedArenaIds[0];

    if (!targetArenaId) {
      throw new BadRequestException('Usuário não possui vínculo com nenhuma Arena.');
    }

    if (user.role !== Role.SUPERADMIN && !managedArenaIds.includes(targetArenaId)) {
      throw new ForbiddenException('Você não tem permissão para adicionar quadras nesta arena.');
    }

    const arena = await this.prisma.arena.findUnique({
      where: { id: targetArenaId },
    });

    if (!arena) {
      throw new NotFoundException('Arena não encontrada.');
    }

    // Upload de fotos (se enviadas)
    const uploadedPhotos: string[] = [];
    if (files && files.length > 0) {
      if (files.length > 3) {
        throw new BadRequestException('Uma quadra pode ter no máximo 3 fotos.');
      }

      for (const file of files) {
        const url = await this.storageService.uploadPhoto(
          file,
          'courts',
          targetArenaId,
        );
        uploadedPhotos.push(url);
      }
    }

    return this.prisma.court.create({
      data: {
        name: dto.name,
        sport: dto.sport,
        hourlyRate: dto.hourlyRate,
        isCovered: dto.isCovered ?? false,
        isActive: true,
        photos: uploadedPhotos,
        arenaId: targetArenaId,
      },
    });
  }

  // 2. Listar Quadras de uma Arena
  async findByArena(arenaId: string, onlyActive = false) {
    return this.prisma.court.findMany({
      where: {
        arenaId,
        ...(onlyActive && { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 3. Buscar Detalhes de uma Quadra por ID
  async findById(courtId: string) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      include: {
        arena: {
          select: { id: true, name: true, city: true, state: true },
        },
      },
    });

    if (!court) {
      throw new NotFoundException('Quadra não encontrada.');
    }

    return court;
  }

  // 4. Atualizar Quadra (Campos + Novas Fotos Unificados)
  async update(
    courtId: string,
    user: any,
    dto: UpdateCourtDto,
    files?: Express.Multer.File[],
  ) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      include: {
        arena: {
          include: { admins: { select: { id: true } } },
        },
      },
    });

    if (!court) {
      throw new NotFoundException('Quadra não encontrada.');
    }

    const isAdmin = court.arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Você só pode gerenciar quadras das suas próprias arenas.');
    }

    const newPhotosUrls: string[] = [];
    if (files && files.length > 0) {
      const currentCount = court.photos.length;
      const incomingCount = files.length;

      if (currentCount + incomingCount > 3) {
        throw new BadRequestException(
          `Limite de fotos excedido! Esta quadra já tem ${currentCount} foto(s) e o limite máximo é 3.`,
        );
      }

      for (const file of files) {
        const url = await this.storageService.uploadPhoto(
          file,
          'courts',
          court.arenaId,
        );
        newPhotosUrls.push(url);
      }
    }

    const dataToUpdate: Prisma.CourtUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.sport && { sport: dto.sport }),
      ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
      ...(dto.isCovered !== undefined && { isCovered: dto.isCovered }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(newPhotosUrls.length > 0 && {
        photos: [...court.photos, ...newPhotosUrls],
      }),
    };

    return this.prisma.court.update({
      where: { id: courtId },
      data: dataToUpdate,
    });
  }

  // 5. Remover Foto Específica da Quadra
  async removeCourtPhoto(courtId: string, user: any, photoUrl: string) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      include: {
        arena: { include: { admins: { select: { id: true } } } },
      },
    });

    if (!court) throw new NotFoundException('Quadra não encontrada.');

    const isAdmin = court.arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Sem permissão para alterar fotos desta quadra.');
    }

    const updatedPhotos = court.photos.filter((p) => p !== photoUrl);

    return this.prisma.court.update({
      where: { id: courtId },
      data: { photos: updatedPhotos },
      select: { id: true, name: true, photos: true },
    });
  }

  // 6. Toggle Status (Ativar / Desativar)
  async toggleStatus(courtId: string, user: any, isActive?: boolean) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      include: {
        arena: { include: { admins: { select: { id: true } } } },
      },
    });

    if (!court) throw new NotFoundException('Quadra não encontrada.');

    const isAdmin = court.arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Sem permissão para alterar status desta quadra.');
    }

    const newStatus = isActive !== undefined ? isActive : !court.isActive;

    return this.prisma.court.update({
      where: { id: courtId },
      data: { isActive: newStatus },
      select: { id: true, name: true, isActive: true },
    });
  }

  // 7. Remover Quadra (com verificação de reservas ativas)
  async remove(courtId: string, user: any) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      include: {
        arena: { include: { admins: { select: { id: true } } } },
      },
    });

    if (!court) throw new NotFoundException('Quadra não encontrada.');

    const isAdmin = court.arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Você só pode remover quadras das suas próprias arenas.');
    }

    // Checa se há agendamentos futuros antes de deletar fisicamente
    const hasActiveBookings = await this.prisma.booking.findFirst({
      where: {
        courtId,
        endTime: { gte: new Date() },
        status: { in: ['CONFIRMED'] },
      },
    });

    if (hasActiveBookings) {
      throw new BadRequestException(
        'Não é possível excluir esta quadra pois ela possui agendamentos futuros. Considere inativá-la em vez de excluir.',
      );
    }

    await this.prisma.court.delete({
      where: { id: courtId },
    });

    return { message: 'Quadra removida com sucesso.' };
  }
}