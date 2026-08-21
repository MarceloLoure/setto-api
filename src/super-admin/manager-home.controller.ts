import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BannerActionType, BannerPosition, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { multerImageFilter, MAX_FILE_SIZE } from '../common/utils/multer-image.filter';
import { HomeService } from '../home/home.service';
import { CreateBannerDto } from '../home/dto/create-banner.dto';
import { CreateHomeSectionDto, ReorderHomeSectionsDto } from '../home/dto/create-home-section.dto';

@ApiTags('Manager - Home & Banners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@Controller('manager/home')
export class ManagerHomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('sections')
  @ApiOperation({ summary: 'Listar todos os blocos/componentes configurados' })
  listSections() {
    return this.homeService.listSections();
  }

  @Post('sections')
  @ApiOperation({ summary: 'Adicionar novo bloco componentizado na Home' })
  createSection(@Body() dto: CreateHomeSectionDto) {
    return this.homeService.createSection(dto);
  }

  @Put('sections/reorder')
  @ApiOperation({ summary: 'Reordenar blocos da Home' })
  reorderSections(@Body() dto: ReorderHomeSectionsDto) {
    return this.homeService.reorderSections(dto);
  }

  @Patch('sections/:id/status')
  @ApiOperation({ summary: 'Ativar ou desativar bloco da Home' })
  toggleSectionStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.homeService.toggleSectionStatus(id, isActive);
  }

  @Post('banners')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: multerImageFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Criar banner (Hero ou Régua/Strip) com upload de imagem' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['position', 'image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Imagem do banner (PNG, JPG, WEBP até 5MB)',
        },
        title: {
          type: 'string',
          example: 'Torneio Aberto de Beach Tennis',
          description: 'Título interno ou descritivo',
        },
        position: {
          type: 'string',
          enum: Object.values(BannerPosition),
          example: BannerPosition.HERO,
          description: 'HERO = Topo, STRIP = Régua/Faixa, POPUP = Modal',
        },
        actionType: {
          type: 'string',
          enum: Object.values(BannerActionType),
          example: BannerActionType.ARENA_DETAILS,
          description: 'Ação ao clicar no banner',
        },
        actionValue: {
          type: 'string',
          example: 'uuid-da-arena-ou-link-externo',
          description: 'ID de destino ou URL externa',
        },
        order: {
          type: 'integer',
          example: 1,
          description: 'Ordem de exibição no carrossel de banners',
        },
        arenaId: {
          type: 'string',
          example: 'uuid-da-arena',
          description: 'Vincular a uma arena específica (opcional)',
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          example: '2026-08-01T00:00:00.000Z',
          description: 'Data de início de veiculação (opcional)',
        },
        endDate: {
          type: 'string',
          format: 'date-time',
          example: '2026-08-31T23:59:59.000Z',
          description: 'Data de término de veiculação (opcional)',
        },
      },
    },
  })
  createBanner(
    @Body() dto: CreateBannerDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.homeService.createBanner(dto, file);
  }
}