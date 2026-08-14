import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ArenasService {
  constructor(private prisma: PrismaService) {}

  // Cria a Arena e promove o Atleta para ARENA_ADMIN diretamente
  async becomeArenaAdmin(userId: string, dto: CreateArenaRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verifica se já existe uma arena com o mesmo CNPJ
    const existingArena = await this.prisma.arena.findUnique({
      where: { cnpj: dto.cnpj },
    });

    if (existingArena) {
      throw new ConflictException('An arena with this Tax ID (CNPJ) already exists');
    }

    // Executa em transação: cria a arena e atualiza o usuário em uma única operação atômica
    const result = await this.prisma.$transaction(async (tx) => {
      const newArena = await this.prisma.arena.create({
        data: {
            name: dto.arenaName,
            cnpj: dto.cnpj,
            city: dto.city,
            state: dto.state,
            admins: {
            connect: { id: userId }, // Vincula na relação N:N
            },
        },
        });

         const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                role: 'ARENA_ADMIN',
                activeArenaId: newArena.id,
            },
            include: {
                arenasManaged: {
                select: { id: true, name: true },
                },
            },
        });

      return { arena: newArena, user: updatedUser };
    });

    return {
      message: 'Arena successfully registered and user promoted to ARENA_ADMIN',
      arena: result.arena,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        activeArenaId: result.user.activeArenaId,
        arenasManaged: result.user.arenasManaged.map((arena) => ({
          id: arena.id,
          name: arena.name,
        }))
      },
    };
  }
}