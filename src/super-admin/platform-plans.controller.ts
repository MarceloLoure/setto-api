import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PlatformPlansService } from './platform-plans.service';
import { CreatePlatformPlanDto } from './dto/create-platform-plan.dto';
import { UpdatePlatformPlanDto } from './dto/update-platform-plan.dto';

@ApiTags('SuperAdmin - Planos SaaS')
@ApiBearerAuth()
@Controller('superadmin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class PlatformPlansController {
  constructor(private readonly platformPlansService: PlatformPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo plano do SaaS (Apenas SuperAdmin)' })
  @ApiResponse({ status: 201, description: 'Plano criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 403, description: 'Acesso negado - Requer Role SUPERADMIN.' })
  async create(@Body() dto: CreatePlatformPlanDto) {
    return this.platformPlansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os planos cadastrados' })
  @ApiResponse({ status: 200, description: 'Lista de planos retornada com sucesso.' })
  async findAll() {
    return this.platformPlansService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de um plano pelo ID' })
  @ApiResponse({ status: 200, description: 'Plano encontrado.' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado.' })
  async findOne(@Param('id') id: string) {
    return this.platformPlansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um plano' })
  @ApiResponse({ status: 200, description: 'Plano atualizado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado.' })
  async update(
    @Param('id') id: string, 
    @Body() dto: UpdatePlatformPlanDto
  ) {
    return this.platformPlansService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Ativar/Desativar um plano' })
  @ApiResponse({ status: 200, description: 'Status do plano alterado com sucesso.' })
  async toggleActive(@Param('id') id: string) {
    return this.platformPlansService.toggleActive(id);
  }
}