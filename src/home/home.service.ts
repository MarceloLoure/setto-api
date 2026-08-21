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

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: FirebaseStorageService,
  ) {}

  // =========================================================================
  // 1. RESOLVER A HOME DINÂMICA DO ATLETA (Server-Driven UI)
  // =========================================================================
  async getHomeFeed(userId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, city: true, state: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

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

        // -------------------------------------------------------------
        // ARENAS NA CIDADE (Com Fallback Dinâmico)
        // -------------------------------------------------------------
        case HomeSectionType.CITY_ARENAS:
          if (user.city) {
            dynamicTitle = `Arenas em ${user.city}`;
            sectionData = await this.prisma.arena.findMany({
              where: {
                isActive: true,
                city: { equals: user.city, mode: 'insensitive' },
              },
              take: 10,
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

          // Se o usuário não tem cidade ou a cidade dele não tem arena cadastrada
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