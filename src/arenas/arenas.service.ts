import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, BookingStatus, Sport } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseStorageService } from '../storage/storage.service';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { FindArenaFollowersQueryDto } from './dto/find-arena-followers-query.dto';
import { FindArenasQueryDto } from './dto/find-arenas-query.dto';
import { UpdateArenaDto } from './dto/update-arena.dto';
import { FindArenaAvailabilityQueryDto } from './dto/find-arena-availability-query.dto';
import { UpdateOperatingHoursDto } from './dto/update-operating-hours.dto';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

@Injectable()
export class ArenasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: FirebaseStorageService,
    private readonly jwtService: JwtService,
  ) {}

  async becomeArenaAdmin(userId: string, dto: CreateArenaRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const cleanedCnpj = dto.cnpj ? dto.cnpj.replace(/\D/g, '') : null;

    if (cleanedCnpj) {
      const existingArena = await this.prisma.arena.findUnique({
        where: { cnpj: cleanedCnpj },
      });

      if (existingArena) {
        throw new ConflictException('Já existe uma arena cadastrada com este CNPJ.');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newArena = await tx.arena.create({
        data: {
          name: dto.name,
          cnpj: cleanedCnpj,
          address: dto.address,
          number: dto.number,
          complement: dto.complement,
          neighborhood: dto.neighborhood,
          zipCode: dto.zipCode ? dto.zipCode.replace(/\D/g, '') : null,
          city: dto.city,
          state: dto.state.toUpperCase(),
          isActive: true,
          admins: {
            connect: { id: userId },
          },
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          role: Role.ARENA_ADMIN,
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

    // O JWT antigo ainda carrega role: ATHLETE — sem emitir um token novo aqui,
    // toda rota @Roles(ARENA_ADMIN) seguinte (criar quadra, editar arena, etc.)
    // seria barrada com 403 até o usuário deslogar e logar de novo.
    const newAccessToken = this.jwtService.sign({
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    return {
      message: 'Arena cadastrada com sucesso e usuário promovido a ARENA_ADMIN.',
      accessToken: newAccessToken,
      arena: result.arena,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        arenasManaged: result.user.arenasManaged,
      },
    };
  }
  async updateArena(
    arenaId: string,
    user: any,
    dto: UpdateArenaDto,
    files?: {
      logo?: Express.Multer.File[];
      cover?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
  ) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: {
        admins: { select: { id: true } },
        logo: true,
        cover: true,
        photos: { where: { isActive: true } },
      },
    });

    if (!arena) throw new NotFoundException('Arena não encontrada.');

    const isAdmin = arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Você não tem permissão para alterar esta arena.');
    }

    let cleanedCnpj: string | undefined = undefined;
    if (dto.cnpj) {
      cleanedCnpj = dto.cnpj.replace(/\D/g, '');
      const existingCnpj = await this.prisma.arena.findFirst({
        where: {
          cnpj: cleanedCnpj,
          id: { not: arenaId },
        },
      });
      if (existingCnpj) {
        throw new ConflictException('Este CNPJ já está em uso por outra arena.');
      }
    }

    const [newLogo, newCover] = await Promise.all([
      files?.logo?.[0]
        ? this.storageService.uploadPhoto(files.logo[0], 'arenas/logos', arenaId)
        : undefined,
      files?.cover?.[0]
        ? this.storageService.uploadPhoto(files.cover[0], 'arenas/covers', arenaId)
        : undefined,
    ]);

    if (newLogo && arena.logo?.path) {
      await this.storageService.deletePhotoByUrl(arena.logo.path);
    }

    if (newCover && arena.cover?.path) {
      await this.storageService.deletePhotoByUrl(arena.cover.path);
    }
    
    const newPhotosData: { name: string; path: string; mimeType: string; sizeBytes: number }[] = [];

      if (files?.photos && files.photos.length > 0) {
        const currentCount = arena.photos.length;
        const incomingCount = files.photos.length;

        if (currentCount + incomingCount > 10) {
          throw new BadRequestException(
            `Limite de fotos excedido! Esta arena já tem ${currentCount} foto(s) ativa(s) e o limite máximo é 10.`,
          );
        }

        for (const file of files.photos) {
          const uploaded = await this.storageService.uploadPhoto(
            file,
            'arenas/photos',
            arenaId,
          );
          newPhotosData.push({
            name: uploaded.name,
            path: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          });
        }
      }

      // 5. Montagem Dinâmica de Atualização com Relações Aninhadas
      const dataToUpdate: Prisma.ArenaUpdateInput = {
        ...(dto.name && { name: dto.name }),
        ...(cleanedCnpj && { cnpj: cleanedCnpj }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.complement !== undefined && { complement: dto.complement }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode.replace(/\D/g, '') }),
        ...(dto.city && { city: dto.city }),
        ...(dto.state && { state: dto.state.toUpperCase() }),

        // Upsert da Logo (cria novo registro ou atualiza o existente)
        ...(newLogo && {
          logo: {
            upsert: {
              create: {
                name: newLogo.name,
                path: newLogo.path,
                mimeType: newLogo.mimeType,
                sizeBytes: newLogo.sizeBytes,
              },
              update: {
                name: newLogo.name,
                path: newLogo.path,
                mimeType: newLogo.mimeType,
                sizeBytes: newLogo.sizeBytes,
              },
            },
          },
        }),

        // Upsert da Capa
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

        // Inserção das novas fotos na galeria
        ...(newPhotosData.length > 0 && {
          photos: {
            create: newPhotosData,
          },
        }),
      };

      // 6. Executa a atualização e retorna o objeto File completo
      return this.prisma.arena.update({
        where: { id: arenaId },
        data: dataToUpdate,
        select: {
          id: true,
          name: true,
          cnpj: true,
          address: true,
          number: true,
          complement: true,
          neighborhood: true,
          zipCode: true,
          city: true,
          state: true,
          isActive: true,
          logo: {
            select: { id: true, name: true, path: true },
          },
          cover: {
            select: { id: true, name: true, path: true },
          },
          photos: {
            where: { isActive: true },
            select: { id: true, name: true, path: true, createdAt: true },
          },
        },
      });
    }

  async removeArenaPhoto(arenaId: string, user: any, photoUrl: string) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: {
        admins: { select: { id: true } },
        photos: {
          select: { id: true, path: true },
        },
      },
    });

    if (!arena) throw new NotFoundException('Arena não encontrada.');

    const isAdmin = arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Sem permissão para alterar fotos desta arena.');
    }

    const remainingPhotos = arena.photos.filter((photo) => photo.path !== photoUrl);

    return this.prisma.arena.update({
      where: { id: arenaId },
      data: {
        photos: {
          set: remainingPhotos.map((photo) => ({ id: photo.id })),
        },
      },
      select: {
        id: true,
        photos: {
          select: { id: true, path: true },
        },
      },
    });
  }

  async toggleStatus(arenaId: string, user: any, isActive?: boolean) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: { admins: { select: { id: true } } },
    });

    if (!arena) throw new NotFoundException('Arena não encontrada.');

    const isAdmin = arena.admins.some((a) => a.id === user.id);
    if (!isAdmin && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Apenas o gestor da arena ou superadmin podem alterar seu status.');
    }

    const newStatus = isActive !== undefined ? isActive : !arena.isActive;

    const updated = await this.prisma.arena.update({
      where: { id: arenaId },
      data: { isActive: newStatus },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return {
      message: `Arena ${updated.name} foi ${updated.isActive ? 'ativada' : 'inativada'} com sucesso.`,
      arena: updated,
    };
  }

  async findAll(query: FindArenasQueryDto, currentUserId?: string) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ArenaWhereInput = {
      isActive: true,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
          { state: { contains: query.search, mode: 'insensitive' } },
          { neighborhood: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

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
          logo: true,
          photos: true,
          address: true,
          number: true,
          complement: true,
          neighborhood: true,
          zipCode: true,
          city: true,
          state: true,
          isActive: true,
          _count: {
            select: {
              courts: { where: { isActive: true } },
              followers: true,
            },
          },
          followers: currentUserId
          ? { where: { userId: currentUserId }, select: { id: true } }
          : false,
          courts: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              sport: true,
              hourlyRate: true,
              isCovered: true,
              photos: true,
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
        logo: arena.logo,
        photos: arena.photos,
        address: arena.address,
        number: arena.number,
        complement: arena.complement,
        neighborhood: arena.neighborhood,
        zipCode: arena.zipCode,
        city: arena.city,
        state: arena.state,
        isActive: arena.isActive,
        totalActiveCourts: arena._count.courts,
        totalFollowers: arena._count.followers,
        isFollowing: currentUserId ? arena.followers.length > 0 : false,
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

  async findById(arenaId: string, currentUserId?: string) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: {
        logo: true,
        cover: true,
        photos: true,
        courts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            sport: true,
            hourlyRate: true,
            isCovered: true,
            photos: true,
          },
        },
        _count: {
          select: { courts: { where: { isActive: true } }, followers: true },
        },
      },
    });

    if (!arena) throw new NotFoundException('Arena não encontrada.');

    let isFollowing = false;
    if (currentUserId) {
      const followRecord = await this.prisma.arenaFollower.findUnique({
        where: { userId_arenaId: { userId: currentUserId, arenaId } },
      });
      isFollowing = !!followRecord;
    }

    return {
      ...arena,
      totalActiveCourts: arena._count.courts,
      totalFollowers: arena._count.followers,
      isFollowing,
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
      await this.prisma.arenaFollower.delete({
        where: { id: existingFollow.id },
      });

      return {
        following: false,
        message: `Você deixou de seguir a arena ${arena.name}.`,
      };
    } else {
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
            logo: true,
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
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: { id: true, name: true },
    });

    if (!arena) {
      throw new NotFoundException('Arena não encontrada.');
    }

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
              avatar: true,
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

  async updateOperatingHours(arenaId: string, user: any, dto: UpdateOperatingHoursDto) {
    const arena = await this.prisma.arena.findUnique({ where: { id: arenaId }, select: { id: true } });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const dayNumbers = dto.schedules.map((s) => s.dayOfWeek);
    if (new Set(dayNumbers).size !== dayNumbers.length) {
      throw new ConflictException(
        'Dias da semana duplicados no mesmo envio. Cada dayOfWeek deve aparecer uma única vez.',
      );
    }
    for (const day of dto.schedules) {
      if (day.isOpen && day.openTime >= day.closeTime) {
        throw new ConflictException(
          `Horário inválido para o dia ${day.dayOfWeek}: openTime deve ser antes de closeTime.`,
        );
      }
    }

    const operations = dto.schedules.map((schedule) =>
      this.prisma.arenaOperatingHour.upsert({
        where: {
          arenaId_dayOfWeek: {
            arenaId,
            dayOfWeek: schedule.dayOfWeek,
          },
        },
        update: {
          openTime: schedule.openTime,
          closeTime: schedule.closeTime,
          isOpen: schedule.isOpen,
        },
        create: {
          arenaId,
          dayOfWeek: schedule.dayOfWeek,
          openTime: schedule.openTime,
          closeTime: schedule.closeTime,
          isOpen: schedule.isOpen,
        },
      })
    );

    const schedules = await this.prisma.$transaction(operations);
    return { arenaId, schedules };
  }

  async addHoliday(arenaId: string, user: any, dateStr: string, description?: string) {
    const arena = await this.prisma.arena.findUnique({ where: { id: arenaId }, select: { id: true } });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const holidayDate = new Date(dateStr);
    holidayDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.arenaHoliday.upsert({
      where: {
        arenaId_date: { arenaId, date: holidayDate },
      },
      update: { description },
      create: { arenaId, date: holidayDate, description },
    });
  }

  async getOperatingHours(arenaId: string, user: any) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: { id: true },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const schedules = await this.prisma.arenaOperatingHour.findMany({
      where: { arenaId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return { arenaId, schedules };
  }

  async getHolidays(arenaId: string, user: any) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: { id: true },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const holidays = await this.prisma.arenaHoliday.findMany({
      where: { arenaId },
      orderBy: { date: 'asc' },
    });

    return { arenaId, holidays };
  }

  async removeHoliday(arenaId: string, user: any, holidayId: string) {
    const arena = await this.prisma.arena.findUnique({ where: { id: arenaId }, select: { id: true } });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const holiday = await this.prisma.arenaHoliday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday || holiday.arenaId !== arenaId) {
      throw new NotFoundException('Fechamento não encontrado para esta arena.');
    }

    await this.validateArenaManagementPermission(arenaId, user);

    await this.prisma.arenaHoliday.delete({ where: { id: holidayId } });
    return { message: 'Fechamento removido com sucesso.' };
  }

  async getAvailability(arenaId: string, query: FindArenaAvailabilityQueryDto) {
    const targetDate = new Date(query.date);
    const dayOfWeek = targetDate.getUTCDay();

    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: {
        id: true,
        name: true,
        isActive: true,
        operatingHours: {
          where: { dayOfWeek },
        },
        holidays: {
          where: {
            date: new Date(query.date),
          },
        },
        courts: {
          where: {
            isActive: true,
            ...(query.sport && { sport: query.sport }),
          },
          select: {
            id: true,
            name: true,
            sport: true,
            hourlyRate: true,
            isCovered: true,
            photos: true,
          },
        },
      },
    });

    if (!arena) throw new NotFoundException('Arena não encontrada.');
    if (!arena.isActive) throw new BadRequestException('Arena temporariamente inativa.');

    // 1. Checagem de Feriado / Dia Fechado
    if (arena.holidays.length > 0) {
      return {
        arena: { id: arena.id, name: arena.name },
        date: query.date,
        isClosed: true,
        reason: arena.holidays[0].description || 'Arena fechada nesta data.',
        courts: [],
      };
    }

    // 2. Checagem do Dia da Semana
    const schedule = arena.operatingHours[0];
    if (schedule && !schedule.isOpen) {
      return {
        arena: { id: arena.id, name: arena.name },
        date: query.date,
        isClosed: true,
        reason: 'A arena não abre neste dia da semana.',
        courts: [],
      };
    }

    // Horários de abertura e fechamento configurados (ou fallback padrão 06:00 - 23:00)
    const openTimeStr = schedule?.openTime || '06:00';
    const closeTimeStr = schedule?.closeTime || '23:00';

    const [openHour, openMin] = openTimeStr.split(':').map(Number);
    const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const now = new Date();

    // 3. Buscar Agendamentos Concorrentes
    const bookings = await this.prisma.booking.findMany({
      where: {
        arenaId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.RESERVED_LOCAL] },
        startTime: { lte: endOfDay },
        endTime: { gte: startOfDay },
      },
      select: {
        id: true,
        courtId: true,
        startTime: true,
        endTime: true,
      },
    });

    const slotMinutes = query.slotDurationMinutes || 60;

    const courtsAvailability = arena.courts.map((court) => {
      const courtBookings = bookings.filter((b) => b.courtId === court.id);
      const slots: {
        startTime: string;
        endTime: string;
        timeLabel: string;
        isAvailable: boolean;
        price: number;
      }[] = [];

      const slotCursor = new Date(startOfDay);
      slotCursor.setUTCHours(openHour, openMin, 0, 0);

      const dayEndLimit = new Date(startOfDay);
      dayEndLimit.setUTCHours(closeHour, closeMin, 0, 0);

      while (slotCursor.getTime() + slotMinutes * 60000 <= dayEndLimit.getTime()) {
        const slotStart = new Date(slotCursor);
        const slotEnd = new Date(slotCursor.getTime() + slotMinutes * 60000);

        const hasConflict = courtBookings.some(
          (b) => slotStart < b.endTime && slotEnd > b.startTime,
        );

        const isPast = slotStart.getTime() <= now.getTime();
        const isAvailable = !hasConflict && !isPast;
        const hourlyRateNum = Number(court.hourlyRate);
        const slotPrice = Number(((slotMinutes / 60) * hourlyRateNum).toFixed(2));

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          timeLabel: `${String(slotStart.getUTCHours()).padStart(2, '0')}:${String(slotStart.getUTCMinutes()).padStart(2, '0')}`,
          isAvailable,
          price: slotPrice,
        });

        slotCursor.setMinutes(slotCursor.getMinutes() + slotMinutes);
      }

      return {
        courtId: court.id,
        courtName: court.name,
        sport: court.sport,
        isCovered: court.isCovered,
        hourlyRate: Number(court.hourlyRate),
        photos: court.photos,
        availableSlotsCount: slots.filter((s) => s.isAvailable).length,
        slots,
      };
    });

    return {
      arena: { id: arena.id, name: arena.name },
      date: query.date,
      isClosed: false,
      operatingWindow: { openTime: openTimeStr, closeTime: closeTimeStr },
      slotDurationMinutes: slotMinutes,
      courts: courtsAvailability,
    };
  }

  private async validateArenaManagementPermission(arenaId: string, user: any) {
    if (user.role === Role.SUPERADMIN) return;

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
      throw new ForbiddenException('Você não tem permissão para gerenciar as configurações desta arena.');
    }
  }

  async getDashboardSummary(arenaId: string, user: any, query: DashboardSummaryQueryDto) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      select: { id: true, name: true },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    await this.validateArenaManagementPermission(arenaId, user);

    const now = new Date();
    const period = query.period || 'week';
    const refDate = query.date ? new Date(`${query.date}T00:00:00.000Z`) : new Date(now);
    refDate.setUTCHours(0, 0, 0, 0);

    const { rangeStart, rangeEnd } = this.resolveDashboardRange(period, refDate);

    const [courts, operatingHours, holidays, bookings, payments, nextBookingsToday] = await Promise.all([
      this.prisma.court.findMany({
        where: { arenaId, isActive: true },
        select: { id: true, name: true, sport: true, hourlyRate: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.arenaOperatingHour.findMany({ where: { arenaId } }),
      this.prisma.arenaHoliday.findMany({
        where: { arenaId, date: { gte: rangeStart, lt: rangeEnd } },
      }),
      this.prisma.booking.findMany({
        where: { arenaId, startTime: { gte: rangeStart, lt: rangeEnd } },
        select: {
          id: true,
          courtId: true,
          startTime: true,
          endTime: true,
          status: true,
          totalAmount: true,
          customerName: true,
          user: { select: { name: true, phone: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: { arenaId, status: 'COMPLETED', paidAt: { gte: rangeStart, lt: rangeEnd } },
        select: { amount: true, method: true, category: true },
      }),
      // Próximas reservas a partir de agora
      this.prisma.booking.findMany({
        where: {
          arenaId,
          startTime: { gte: now },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESERVED_LOCAL, BookingStatus.PENDING] },
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          totalAmount: true,
          customerName: true,
          user: { select: { name: true } },
          court: { select: { name: true } },
        },
      }),
    ]);

    // 1. Cálculo de Dias Úteis Operacionais e Slots
    const scheduleByDay = new Map(operatingHours.map((h) => [h.dayOfWeek, h]));
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const slotMinutes = 60;

    let totalSlotsPerCourt = 0;
    let operationalDaysCount = 0;

    for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = cursor.toISOString().slice(0, 10);
      if (holidayDates.has(dateKey)) continue;

      const dayOfWeek = cursor.getUTCDay();
      const schedule = scheduleByDay.get(dayOfWeek);
      if (schedule && !schedule.isOpen) continue;

      operationalDaysCount++;
      const openTimeStr = schedule?.openTime || '06:00';
      const closeTimeStr = schedule?.closeTime || '23:00';
      const [openHour, openMin] = openTimeStr.split(':').map(Number);
      const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);

      totalSlotsPerCourt += Math.max(0, Math.floor(((closeHour * 60 + closeMin) - (openHour * 60 + openMin)) / slotMinutes));
    }

    // 2. Classificação de Reservas
    const activeBookings = bookings.filter((b) => b.status !== BookingStatus.CANCELLED);
    const cancelledBookings = bookings.filter((b) => b.status === BookingStatus.CANCELLED);
    const completedBookings = bookings.filter((b) => b.status === BookingStatus.COMPLETED);

    // 3. Status Ao Vivo (Jogos acontecendo exatamente no horário atual)
    const currentActiveBookings = bookings.filter(
      (b) =>
        b.status !== BookingStatus.CANCELLED &&
        new Date(b.startTime) <= now &&
        new Date(b.endTime) > now,
    );

    const liveOccupancy = {
      totalCourts: courts.length,
      courtsInUseCount: currentActiveBookings.length,
      courtsFreeCount: Math.max(0, courts.length - currentActiveBookings.length),
      currentMatches: currentActiveBookings.map((b) => ({
        bookingId: b.id,
        courtId: b.courtId,
        client: b.customerName || b.user?.name || 'Cliente Balcão',
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    };

    // 4. Mapa de Ocupação por Quadra
    const courtsSummary = courts.map((court) => {
      const courtActiveBookings = activeBookings.filter((b) => b.courtId === court.id);
      const bookedSlots = courtActiveBookings.reduce((sum, b) => {
        const durationMinutes = (b.endTime.getTime() - b.startTime.getTime()) / 60000;
        return sum + Math.max(1, Math.round(durationMinutes / slotMinutes));
      }, 0);
      const freeSlots = Math.max(0, totalSlotsPerCourt - bookedSlots);

      return {
        courtId: court.id,
        courtName: court.name,
        sport: court.sport,
        totalSlots: totalSlotsPerCourt,
        bookedSlots,
        freeSlots,
        occupancyRate: totalSlotsPerCourt > 0 ? Number(((bookedSlots / totalSlotsPerCourt) * 100).toFixed(1)) : 0,
        bookingsCount: courtActiveBookings.length,
      };
    });

    // 5. Métricas de Receita e Projeção
    const revenueByMethod: Record<string, number> = {};
    const revenueByCategory: Record<string, number> = {};
    let totalRevenue = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);
      totalRevenue += amount;
      revenueByMethod[payment.method] = (revenueByMethod[payment.method] || 0) + amount;
      revenueByCategory[payment.category] = (revenueByCategory[payment.category] || 0) + amount;
    }

    // Valor total reservado na grade no período (incluindo o que ainda vai ser pago)
    const totalBookedValue = activeBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

    // 6. Médias e Indicadores
    const dailyAverageRevenue = operationalDaysCount > 0 ? Number((totalRevenue / operationalDaysCount).toFixed(2)) : 0;
    const averageTicket = activeBookings.length > 0 ? Number((totalRevenue / activeBookings.length).toFixed(2)) : 0;
    const cancellationRate = bookings.length > 0 ? Number(((cancelledBookings.length / bookings.length) * 100).toFixed(1)) : 0;

    return {
      arena: { id: arena.id, name: arena.name },
      period,
      rangeStart: rangeStart.toISOString().slice(0, 10),
      rangeEnd: new Date(rangeEnd.getTime() - 86400000).toISOString().slice(0, 10),

      // Bloco Ao Vivo
      live: liveOccupancy,

      // Próximos horários do dia
      upcomingToday: nextBookingsToday.map((b) => ({
        id: b.id,
        courtName: b.court.name,
        clientName: b.customerName || b.user?.name || 'Cliente Balcão',
        startTime: b.startTime,
        endTime: b.endTime,
        totalAmount: b.totalAmount,
        status: b.status,
      })),

      // Indicadores Gerais e Médias
      kpis: {
        dailyAverageRevenue,
        averageTicket,
        cancellationRate,
        operationalDays: operationalDaysCount,
        totalBookedValue: Number(totalBookedValue.toFixed(2)),
        pendingRevenueToReceive: Number(Math.max(0, totalBookedValue - totalRevenue).toFixed(2)),
      },

      bookings: {
        total: bookings.length,
        confirmed: activeBookings.length,
        cancelled: cancelledBookings.length,
        completed: completedBookings.length,
      },

      revenue: {
        total: Number(totalRevenue.toFixed(2)),
        byMethod: revenueByMethod,
        byCategory: revenueByCategory,
      },

      courts: courtsSummary,
    };
  }

  private resolveDashboardRange(period: 'day' | 'week' | 'month', refDate: Date) {
    const rangeStart = new Date(refDate);
    const rangeEnd = new Date(refDate);

    if (period === 'day') {
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    } else if (period === 'week') {
      // Semana de domingo a sábado, mesma convenção usada em dayOfWeek (0 = domingo)
      const dayOfWeek = rangeStart.getUTCDay();
      rangeStart.setUTCDate(rangeStart.getUTCDate() - dayOfWeek);
      rangeEnd.setTime(rangeStart.getTime());
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
    } else {
      rangeStart.setUTCDate(1);
      rangeEnd.setTime(rangeStart.getTime());
      rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 1);
    }

    return { rangeStart, rangeEnd };
  }
}