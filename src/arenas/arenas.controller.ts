import { Body, Controller, Get, Param, Query, Post, UseGuards, Request, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ArenasService } from './arenas.service'
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FindArenasQueryDto } from './dto/find-arenas-query.dto';
import { FindArenaFollowersQueryDto } from './dto/find-arena-followers-query.dto';

@ApiTags('Arenas')
@Controller('arenas')
export class ArenasController {
  constructor(private readonly arenasService: ArenasService) {}

  @Post('become-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade an ATHLETE account to ARENA_ADMIN by registering a new Arena' })
  @ApiResponse({ status: 201, description: 'Arena registered and user promoted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Tax ID (CNPJ) already in use' })
  becomeArenaAdmin(@Request() req, @Body() dto: CreateArenaRequestDto) {
    const userId = req.user.id; // Extraído do Token JWT
    return this.arenasService.becomeArenaAdmin(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar arenas cadastradas com busca e paginação' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de arenas retornada com sucesso.',
  })
  findAll(@Query() query: FindArenasQueryDto) {
    return this.arenasService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma arena por ID' })
  findById(@Param('id') id: string, @CurrentUser('id') currentUserId?: string) {
    return this.arenasService.findById(id, currentUserId);
  }

  @Post(':id/toggle-follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seguir ou Deixar de seguir uma arena (Toggle)' })
  @ApiResponse({
    status: 200,
    description: 'Status de seguimento atualizado (following: true/false)',
  })
  toggleFollow(@Param('id') arenaId: string, @Request() req) {
    return this.arenasService.toggleFollow(req.user.id, arenaId);
  }

    @Get(':id/followers')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ARENA_ADMIN, Role.RECEPTIONIST, Role.SUPERADMIN)
    @ApiBearerAuth()
    @ApiOperation({
    summary: 'Listar seguidores da arena (Exclusivo para Gestores da Arena e Superadmin)',
    })
    @ApiResponse({
    status: 200,
    description: 'Lista paginada de seguidores retornada com sucesso.',
    })
    @ApiResponse({
    status: 403,
    description: 'Acesso negado caso o usuário não gerencie esta arena.',
    })
    getArenaFollowers(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Query() query: FindArenaFollowersQueryDto,
    ) {
    return this.arenasService.getArenaFollowers(arenaId, user, query);
    }
}