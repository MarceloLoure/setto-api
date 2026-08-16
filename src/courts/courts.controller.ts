import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MAX_FILE_SIZE, multerImageFilter } from '../common/utils/multer-image.filter';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@ApiTags('Courts')
@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FilesInterceptor('photos', 3, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: multerImageFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cadastrar nova quadra com até 3 fotos' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Fotos da quadra (até 3)',
        },
        name: { type: 'string', example: 'Quadra 1 - Central' },
        sport: { type: 'string', enum: ['BEACH_TENNIS', 'PADEL', 'FOOTVOLLEY', 'VOLLEYBALL'], example: 'BEACH_TENNIS' },
        hourlyRate: { type: 'number', example: 90.0 },
        isCovered: { type: 'boolean', example: true },
        arenaId: { type: 'string', example: 'uuid-da-arena' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Quadra cadastrada com sucesso.' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateCourtDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.courtsService.create(user, dto, files);
  }

  @Get('arena/:arenaId')
  @ApiOperation({ summary: 'Listar todas as quadras de uma arena (Público)' })
  findByArena(
    @Param('arenaId') arenaId: string,
    @Query('onlyActive') onlyActive?: boolean,
  ) {
    return this.courtsService.findByArena(arenaId, onlyActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma quadra por ID (Público)' })
  findById(@Param('id') courtId: string) {
    return this.courtsService.findById(courtId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FilesInterceptor('photos', 3, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: multerImageFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Atualizar dados da quadra e anexar novas fotos (até 3 acumuladas)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Novas fotos da quadra',
        },
        name: { type: 'string', example: 'Quadra 1 - Central Coberta' },
        sport: { type: 'string', enum: ['BEACH_TENNIS', 'PADEL', 'FOOTVOLLEY', 'VOLLEYBALL'] },
        hourlyRate: { type: 'number', example: 100.0 },
        isCovered: { type: 'boolean', example: true },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  update(
    @Param('id') courtId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCourtDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.courtsService.update(courtId, user, dto, files);
  }

  @Delete(':id/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover uma foto específica da quadra' })
  deletePhoto(
    @Param('id') courtId: string,
    @CurrentUser() user: any,
    @Query('photoUrl') photoUrl: string,
  ) {
    return this.courtsService.removeCourtPhoto(courtId, user, photoUrl);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar ou Desativar uma quadra' })
  toggleStatus(
    @Param('id') courtId: string,
    @CurrentUser() user: any,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.courtsService.toggleStatus(courtId, user, isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Excluir uma quadra (bloqueia se houver agendamentos futuros)' })
  remove(@Param('id') courtId: string, @CurrentUser() user: any) {
    return this.courtsService.remove(courtId, user);
  }
}