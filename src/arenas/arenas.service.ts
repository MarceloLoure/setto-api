import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { Role } from '@prisma/client';
import { FindArenasQueryDto } from './dto/find-arenas-query.dto';
import { FindArenaFollowersQueryDto } from './dto/find-arena-followers-query.dto';

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

  async findAll(query: FindArenasQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtro de busca por nome, cidade ou estado
    const where: Prisma.ArenaWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
            { state: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Executa a contagem total e a busca em paralelo para alta performance
    const [total, arenas] = await Promise.all([
      this.prisma.arena.count({ where }),
      this.prisma.arena.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          cnpj: true,
          address: true,
          city: true,
          state: true,
          _count: {
            select: {
              courts: { where: { isActive: true } },
            },
          },
          courts: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              sport: true,
              hourlyRate: true,
              isCovered: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: arenas.map((arena) => ({
        id: arena.id,
        name: arena.name,
        cnpj: arena.cnpj,
        address: arena.address,
        city: arena.city,
        state: arena.state,
        totalActiveCourts: arena._count.courts,
        courts: arena.courts,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

    async findById(id: string, currentUserId?: string) {
    const arena = await this.prisma.arena.findUnique({
        where: { id },
        include: {
        _count: {
            select: {
            followers: true,
            courts: { where: { isActive: true } },
            },
        },
        followers: currentUserId
            ? {
                where: { userId: currentUserId },
                select: { id: true },
            }
            : false,
        courts: {
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                sport: true,
                hourlyRate: true,
                isCovered: true,
                },
            },
            },
        });

    if (!arena) {
        throw new NotFoundException('Arena não encontrada.');
    }

    return {
        ...arena,
        totalFollowers: arena._count.followers,
        totalActiveCourts: arena._count.courts,
        isFollowing: currentUserId ? arena.followers.length > 0 : false,
    };
    }

  async toggleFollow(userId: string, arenaId: string) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: { id: true, name: true },
    });

    if (!arena) {
      throw new NotFoundException('Arena não encontrada.');
    }

    const existingFollow = await this.prisma.arenaFollower.findUnique({
      where: {
        userId_arenaId: {
          userId,
          arenaId,
        },
      },
    });

    if (existingFollow) {
      // Deixar de seguir
      await this.prisma.arenaFollower.delete({
        where: { id: existingFollow.id },
      });

      return {
        following: false,
        message: `Você deixou de seguir a arena ${arena.name}.`,
      };
    } else {
      // Começar a seguir
      await this.prisma.arenaFollower.create({
        data: {
          userId,
          arenaId,
        },
      });

      return {
        following: true,
        message: `Você agora está seguindo a arena ${arena.name}!`,
      };
    }
  }

  async getFollowedArenas(userId: string) {
    const follows = await this.prisma.arenaFollower.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        arena: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            _count: {
              select: {
                followers: true,
                courts: { where: { isActive: true } },
              },
            },
            courts: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                sport: true,
                hourlyRate: true,
                isCovered: true,
              },
            },
          },
        },
      },
    });

    return follows.map((item) => ({
      ...item.arena,
      totalFollowers: item.arena._count.followers,
      totalActiveCourts: item.arena._count.courts,
      isFollowing: true,
    }));
  }

  async getArenaFollowers(
    arenaId: string,
    user: any,
    query: FindArenaFollowersQueryDto,
    ) {
    // 1. Checa se a arena existe
    const arena = await this.prisma.arena.findUnique({
        where: { id: arenaId },
        select: { id: true, name: true },
    });

    if (!arena) {
        throw new NotFoundException('Arena não encontrada.');
    }

    // 2. Validação de Segurança / Posse (anti-IDOR)
    if (user.role !== Role.SUPERADMIN) {
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

        if (!allowedArenaIds.includes(arenaId)) {
        throw new ForbiddenException(
            'Você não tem permissão para visualizar os seguidores desta arena.',
        );
        }
    }

    // 3. Paginação e Filtros
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ArenaFollowerWhereInput = {
        arenaId,
        ...(query.search && {
        user: {
            OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            ],
        },
        }),
    };

    const [total, followers] = await Promise.all([
        this.prisma.arenaFollower.count({ where }),
        this.prisma.arenaFollower.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatarUrl: true,
                role: true,
                btRating: true,
                footvolleyElo: true,
                createdAt: true,
            },
            },
        },
        }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        arena: {
        id: arena.id,
        name: arena.name,
        },
        data: followers.map((item) => ({
        followedAt: item.createdAt,
        user: item.user,
        })),
        meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        },
    };
    }
}