import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseStorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: FirebaseStorageService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        gender: true,
        birthDate: true,
        city: true,
        state: true,
        avatar: true,
        cover: true,
        bio: true,
        role: true,
        btRating: true,
        footvolleyElo: true,
        arenasManaged: { select: { id: true, name: true } },
        arenasEmployed: { select: { id: true, name: true } },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    files?: {
      avatar?: Express.Multer.File[];
      cover?: Express.Multer.File[];
    },
  ) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        avatar: true,
        cover: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // 1. Validação de CPF
    let cleanedCpf: string | undefined = undefined;
    if (dto.cpf) {
      cleanedCpf = dto.cpf.replace(/\D/g, '');

      if (cleanedCpf.length !== 11) {
        throw new ConflictException('CPF inválido. Deve conter 11 dígitos.');
      }

      const cpfExists = await this.prisma.user.findFirst({
        where: {
          cpf: cleanedCpf,
          id: { not: userId },
        },
      });

      if (cpfExists) {
        throw new ConflictException('Este CPF já está cadastrado em outra conta.');
      }
    }

    const [newAvatar, newCover] = await Promise.all([
      files?.avatar?.[0]
        ? this.storageService.uploadPhoto(files.avatar[0], 'avatars', userId)
        : undefined,
      files?.cover?.[0]
        ? this.storageService.uploadPhoto(files.cover[0], 'covers', userId)
        : undefined,
    ]);

    // Limpa a foto antiga do bucket se uma nova foi enviada
    if (newAvatar && currentUser.avatar?.path) {
      await this.storageService.deletePhotoByUrl(currentUser.avatar.path);
    }

    if (newCover && currentUser.cover?.path) {
      await this.storageService.deletePhotoByUrl(currentUser.cover.path);
    }

    const dataToUpdate: Prisma.UserUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
      ...(cleanedCpf && { cpf: cleanedCpf }),

      ...(newAvatar && {
        avatar: {
          upsert: {
            create: {
              name: newAvatar.name,
              path: newAvatar.path,
              mimeType: newAvatar.mimeType,
              sizeBytes: newAvatar.sizeBytes,
            },
            update: {
              name: newAvatar.name,
              path: newAvatar.path,
              mimeType: newAvatar.mimeType,
              sizeBytes: newAvatar.sizeBytes,
            },
          },
        },
      }),

      ...(newCover && {
        cover: {
          upsert: {
            create: {
              name: newCover.name,
              path: newCover.path,
              mimeType: newCover.mimeType,
              sizeBytes: newCover.sizeBytes,
            },
            update: {
              name: newCover.name,
              path: newCover.path,
              mimeType: newCover.mimeType,
              sizeBytes: newCover.sizeBytes,
            },
          },
        },
      }),
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        gender: true,
        birthDate: true,
        city: true,
        state: true,
        bio: true,
        role: true,
        btRating: true,
        footvolleyElo: true,
        avatar: {
          select: { id: true, name: true, path: true },
        },
        cover: {
          select: { id: true, name: true, path: true },
        },
      },
    });
  }
}