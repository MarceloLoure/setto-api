import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BannerPosition, BookingStatus, HomeSectionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseStorageService } from '../storage/storage.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreateHomeSectionDto, ReorderHomeSectionsDto } from './dto/create-home-section.dto';
import { BannerActionType } from '@prisma/client';

interface LocationFilter {
  userCity?: string;
}

function normalizeSearchString(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9]/g, '')    // Remove espaços e pontuações
    .toLowerCase();
}

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: FirebaseStorageService,
  ) {}

  // =========================================================================
  // 1. RESOLVER A HOME DINÂMICA DO ATLETA (Server-Driven UI)
  // =========================================================================
  async getHomeFeed(userId: string, locationParams?: LocationFilter) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, city: true, state: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const targetCity = locationParams?.userCity?.trim() || user.city;

    const activeSections = await this.prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    const renderedSections: Array<{
      id: string;
      type: HomeSectionType;
      title?: string | null;
      subtitle?: string | null;
      data: any;
    }> = [];

    for (const section of activeSections) {
      let sectionData: any = null;
      let dynamicTitle = section.title;
      let dynamicSubtitle = section.subtitle;

      switch (section.type) {
        // -------------------------------------------------------------
        // HERO BANNERS
        // -------------------------------------------------------------
        case HomeSectionType.HERO_BANNERS:
          sectionData = await this.prisma.banner.findMany({
            where: {
              position: BannerPosition.HERO,
              isActive: true,
              OR: [
                { startDate: null, endDate: null },
                { startDate: { lte: now }, endDate: { gte: now } },
              ],
            },
            orderBy: { order: 'asc' },
            include: { image: { select: { id: true, path: true } } },
          });
          break;

        // -------------------------------------------------------------
        // STRIP BANNER
        // -------------------------------------------------------------
        case HomeSectionType.STRIP_BANNER:
          sectionData = await this.prisma.banner.findFirst({
            where: {
              position: BannerPosition.STRIP,
              isActive: true,
              OR: [
                { startDate: null, endDate: null },
                { startDate: { lte: now }, endDate: { gte: now } },
              ],
            },
            orderBy: { order: 'asc' },
            include: { image: { select: { id: true, path: true } } },
          });
          break;

        // -------------------------------------------------------------
        // PRÓXIMOS JOGOS
        // -------------------------------------------------------------
        case HomeSectionType.NEXT_BOOKINGS:
          sectionData = await this.prisma.booking.findMany({
            where: {
              userId,
              startTime: { gte: now },
              status: {
                in: [
                  BookingStatus.CONFIRMED,
                  BookingStatus.RESERVED_LOCAL,
                  BookingStatus.PENDING,
                ],
              },
            },
            take: 5,
            orderBy: { startTime: 'asc' },
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true,
              totalAmount: true,
              court: { select: { id: true, name: true, sport: true } },
              arena: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  logo: { select: { path: true } },
                },
              },
            },
          });
          break;

        // -------------------------------------------------------------
        // ARENAS SEGUIDAS (Com Fallback para Arenas Populares)
        // -------------------------------------------------------------
        case HomeSectionType.FOLLOWED_ARENAS:
          sectionData = await this.prisma.arena.findMany({
            where: { isActive: true, followers: { some: { userId } } },
            take: 10,
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              logo: { select: { id: true, path: true } },
              cover: { select: { id: true, path: true } },
              _count: { select: { courts: true, followers: true } },
            },
          });

          // Se não segue ninguém, sugere os clubes mais ativos
          if (sectionData.length === 0) {
            dynamicTitle = 'Clubes para Conhecer';
            dynamicSubtitle = 'Siga arenas para acompanhar horários e torneios';
            sectionData = await this.prisma.arena.findMany({
              where: { isActive: true },
              take: 8,
              orderBy: { followers: { _count: 'desc' } },
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                logo: { select: { id: true, path: true } },
                cover: { select: { id: true, path: true } },
                _count: { select: { courts: true, followers: true } },
              },
            });
          }
          break;

        case HomeSectionType.CITY_ARENAS:
          if (targetCity) {
            const normalizedCity = normalizeSearchString(targetCity);

            const rawArenas = await this.prisma.$queryRaw<
              Array<{
                id: string;
                name: string;
                neighborhood: string | null;
                city: string;
                state: string;
                logo_path: string | null;
                logo_id: string | null;
                cover_path: string | null;
                cover_id: string | null;
                courts_count: bigint;
                followers_count: bigint;
              }>
            >`
              SELECT 
                a.id, 
                a.name, 
                a.neighborhood, 
                a.city, 
                a.state,
                l.path AS logo_path,
                l.id AS logo_id,
                c.path AS cover_path,
                c.id AS cover_id,
                (SELECT COUNT(*) FROM "courts" ct WHERE ct."arenaId" = a.id) AS courts_count,
                (SELECT COUNT(*) FROM "arena_followers" f WHERE f."arenaId" = a.id) AS followers_count
              FROM "arenas" a
              LEFT JOIN "files" l ON l."arenaIdLogo" = a.id
              LEFT JOIN "files" c ON c."arenaIdCover" = a.id
              WHERE a."isActive" = true
                AND LOWER(REGEXP_REPLACE(UNACCENT(a.city), '[^a-zA-Z0-9]', '', 'g')) = ${normalizedCity}
              LIMIT 10;
            `;

            if (rawArenas.length > 0) {
              dynamicTitle = `Arenas em ${rawArenas[0].city}`;
              sectionData = rawArenas.map((arena) => ({
                id: arena.id,
                name: arena.name,
                neighborhood: arena.neighborhood,
                city: arena.city,
                state: arena.state,
                logo: arena.logo_path ? { id: arena.logo_id, path: arena.logo_path } : null,
                cover: arena.cover_path ? { id: arena.cover_id, path: arena.cover_path } : null,
                _count: {
                  courts: Number(arena.courts_count),
                  followers: Number(arena.followers_count),
                },
              }));
            }
          }

          // Fallback se targetCity for nulo ou se não houver arenas encontradas na cidade
          if (!sectionData || sectionData.length === 0) {
            dynamicTitle = 'Arenas Principais';
            dynamicSubtitle = 'As melhores estruturas esportivas';
            sectionData = await this.prisma.arena.findMany({
              where: { isActive: true },
              take: 10,
              orderBy: { courts: { _count: 'desc' } },
              select: {
                id: true,
                name: true,
                neighborhood: true,
                city: true,
                state: true,
                logo: { select: { id: true, path: true } },
                cover: { select: { id: true, path: true } },
                _count: { select: { courts: true, followers: true } },
              },
            });
          }
          break;
        // -------------------------------------------------------------
        // RECOMENDAÇÕES / EM ALTA
        // -------------------------------------------------------------
        case HomeSectionType.RECOMMENDED_ARENAS:
          sectionData = await this.prisma.arena.findMany({
            where: { isActive: true },
            take: 10,
            orderBy: [
              { followers: { _count: 'desc' } },
              { courts: { _count: 'desc' } },
            ],
            select: {
              id: true,
              name: true,
              neighborhood: true,
              city: true,
              state: true,
              logo: { select: { id: true, path: true } },
              cover: { select: { id: true, path: true } },
              _count: { select: { courts: true, followers: true } },
            },
          });
          break;
      }

      // Regra de inserção: Next Bookings só vai para o payload se tiver agendamento ativo (ou envie sempre se quiser o card CTA no app)
      const hasContent = Array.isArray(sectionData) ? sectionData.length > 0 : !!sectionData;
      if (hasContent) {
        renderedSections.push({
          id: section.id,
          type: section.type,
          title: dynamicTitle,
          subtitle: dynamicSubtitle,
          data: sectionData,
        });
      }
    }

    return {
      userCity: user.city,
      sections: renderedSections,
    };
  }

  // =========================================================================
  // 2. GESTÃO DOS COMPONENTES DA HOME (PAINEL ADMIN)
  // =========================================================================
  async createSection(dto: CreateHomeSectionDto) {
    const existingOrder = await this.prisma.homeSection.findFirst({
      where: { order: dto.order, isActive: true },
    });

    if (existingOrder) {
      throw new ConflictException(
        `Já existe um componente ativo ocupando a posição ${dto.order}. Reordene os componentes antes de adicionar.`,
      );
    }

    return this.prisma.homeSection.create({
      data: {
        type: dto.type,
        title: dto.title,
        subtitle: dto.subtitle,
        order: dto.order,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listSections() {
    return this.prisma.homeSection.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async reorderSections(dto: ReorderHomeSectionsDto) {
    const operations = dto.sections.map((sec) =>
      this.prisma.homeSection.update({
        where: { id: sec.id },
        data: { order: sec.order },
      }),
    );

    await this.prisma.$transaction(operations);
    return { message: 'Ordem dos componentes atualizada com sucesso.' };
  }

  async toggleSectionStatus(sectionId: string, isActive: boolean) {
    return this.prisma.homeSection.update({
      where: { id: sectionId },
      data: { isActive },
    });
  }

  // =========================================================================
  // 3. GESTÃO DE BANNERS (PAINEL ADMIN)
  // =========================================================================
  async createBanner(dto: CreateBannerDto, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A imagem do banner é obrigatória.');

    const uploaded = await this.storageService.uploadPhoto(
      file,
      'banners',
      dto.arenaId || 'global',
    );

    return this.prisma.banner.create({
      data: {
        title: dto.title || null,
        position: dto.position,
        actionType: dto.actionType || BannerActionType.NONE,
        actionValue: dto.actionValue || null,
        order: dto.order ? Number(dto.order) : 1,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        ...(dto.arenaId && {
          arena: {
            connect: { id: dto.arenaId },
          },
        }),
        image: {
          create: {
            name: uploaded.name,
            path: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
        },
      },
      include: {
        image: { select: { id: true, path: true } },
      },
    });
  }
}