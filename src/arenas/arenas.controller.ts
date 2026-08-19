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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
import { ArenasService } from './arenas.service';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { FindArenaFollowersQueryDto } from './dto/find-arena-followers-query.dto';
import { FindArenasQueryDto } from './dto/find-arenas-query.dto';
import { ToggleArenaStatusDto } from './dto/toggle-arena-status.dto';
import { UpdateArenaDto } from './dto/update-arena.dto';
import { FindArenaAvailabilityQueryDto } from './dto/find-arena-availability-query.dto';

@ApiTags('Arenas')
@Controller('arenas')
export class ArenasController {
  constructor(private readonly arenasService: ArenasService) {}

  @Post('become-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar nova arena e promover usuário para ARENA_ADMIN' })
  @ApiResponse({ status: 201, description: 'Arena cadastrada e usuário promovido com sucesso.' })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado.' })
  becomeArenaAdmin(
    @CurrentUser('id') currentUserId: string,
    @Body() dto: CreateArenaRequestDto,
  ) {
    return this.arenasService.becomeArenaAdmin(currentUserId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar arenas cadastradas com busca e paginação (Público)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de arenas.' })
  findAll(@Query() query: FindArenasQueryDto, @CurrentUser('id') currentUserId?: string) {
    return this.arenasService.findAll(query, currentUserId);
  }

  @Get('following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar arenas seguidas pelo usuário logado' })
  @ApiResponse({ status: 200, description: 'Lista de arenas que o usuário segue.' })
  getFollowedArenas(@CurrentUser('id') currentUserId: string) {
    return this.arenasService.getFollowedArenas(currentUserId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar detalhes de uma arena por ID' })
  findById(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.arenasService.findById(id, userId);
  }

  @Post(':id/toggle-follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seguir ou Deixar de seguir uma arena (Toggle)' })
  @ApiResponse({ status: 200, description: 'Status de follow atualizado.' })
  toggleFollow(
    @Param('id') arenaId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.arenasService.toggleFollow(currentUserId, arenaId);
  }

  @Get(':id/followers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.RECEPTIONIST, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar seguidores da arena (Exclusivo para Gestores da Arena e Superadmin)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de seguidores.' })
  @ApiResponse({ status: 403, description: 'Acesso negado caso o usuário não gerencie esta arena.' })
  getArenaFollowers(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Query() query: FindArenaFollowersQueryDto,
  ) {
    return this.arenasService.getArenaFollowers(arenaId, user, query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
        { name: 'photos', maxCount: 10 },
      ],
      {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: multerImageFilter,
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Atualizar dados cadastrais, endereço, logo e adicionar fotos em uma única chamada',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: { type: 'string', format: 'binary', description: 'Nova Logo (opcional)' },
        cover: { type: 'string', format: 'binary', description: 'Foto de capa (1 imagem)' },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Novas fotos da galeria (até 10 acumuladas)',
        },
        name: { type: 'string', example: 'Arena Beach Social Londrina' },
        cnpj: { type: 'string', example: '12.345.678/0001-90' },
        address: { type: 'string', example: 'Av. Madre Leônia Milito' },
        number: { type: 'string', example: '1500' },
        complement: { type: 'string', example: 'Bloco A' },
        neighborhood: { type: 'string', example: 'Gleba Palhano' },
        zipCode: { type: 'string', example: '86050-270' },
        city: { type: 'string', example: 'Londrina' },
        state: { type: 'string', example: 'PR' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Arena atualizada com sucesso.' })
  updateArena(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateArenaDto,
    @UploadedFiles()
    files?: {
      logo?: Express.Multer.File[];
      cover?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
  ) {
    return this.arenasService.updateArena(arenaId, user, dto, files);
  }

  @Delete(':id/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover uma foto específica da galeria da arena' })
  deletePhoto(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Query('photoUrl') photoUrl: string,
  ) {
    return this.arenasService.removeArenaPhoto(arenaId, user, photoUrl);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar ou Inativar a arena (Dono da Arena ou Superadmin)' })
  @ApiResponse({ status: 200, description: 'Status da arena atualizado com sucesso.' })
  toggleStatus(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Body() dto: ToggleArenaStatusDto,
  ) {
    return this.arenasService.toggleStatus(arenaId, user, dto.isActive);
  }

    @Get(':id/availability')
    @ApiOperation({
        summary: 'Consultar grade de horários vagos e ocupados de uma arena por dia (Visão do Atleta)',
    })
    @ApiResponse({
        status: 200,
        description: 'Grade de horários por quadra retornada com sucesso.',
    })
    getAvailability(
    @Param('id') arenaId: string,
    @Query() query: FindArenaAvailabilityQueryDto,
    ) {
    return this.arenasService.getAvailability(arenaId, query);
    }
}