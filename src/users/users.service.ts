import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
        avatarUrl: true,
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
    });

    if (!currentUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // 1. Tratamento e Validação de CPF
    let cleanedCpf: string | undefined = undefined;
    if (dto.cpf) {
      cleanedCpf = dto.cpf.replace(/\D/g, ''); // Mantém apenas dígitos

      if (cleanedCpf.length !== 11) {
        throw new ConflictException('CPF inválido. Deve conter 11 dígitos.');
      }

      // Checa se o CPF já pertence a outro usuário
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

    // 2. Upload de Arquivos (Avatar e Cover) em paralelo
    let avatarUrl: string | undefined = undefined;
    let coverUrl: string | undefined = undefined;

    const uploadPromises: Promise<any>[] = [];

    if (files?.avatar?.[0]) {
      uploadPromises.push(
        this.storageService
          .uploadPhoto(files.avatar[0], 'avatars', userId)
          .then((url) => (avatarUrl = url)),
      );
    }

    if (files?.cover?.[0]) {
      uploadPromises.push(
        this.storageService
          .uploadPhoto(files.cover[0], 'covers', userId)
          .then((url) => (coverUrl = url)),
      );
    }

    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
    }

    // 3. Atualização no banco
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
        bio: dto.bio,
        gender: dto.gender,
        city: dto.city,
        state: dto.state,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        ...(cleanedCpf && { cpf: cleanedCpf }),
        ...(avatarUrl && { avatarUrl }),
        ...(coverUrl && { coverUrl }),
      },
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
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        role: true,
        btRating: true,
        footvolleyElo: true,
      },
    });
  }
}