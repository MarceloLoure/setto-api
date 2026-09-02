import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlatformPlansService } from './platform-plans.service';
import { CreatePlatformPlanDto } from './dto/create-platform-plan.dto';
import { UpdatePlatformPlanDto } from './dto/update-platform-plan.dto';
import { SubscribeToPlatformPlanDto } from './dto/subscribe-platform-plan.dto';

@ApiTags('Platform Plans (SaaS B2B)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-plans')
export class PlatformPlansController {
  constructor(private readonly service: PlatformPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar planos disponíveis da plataforma Setto' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] Criar plano da plataforma' })
  create(@Body() dto: CreatePlatformPlanDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] Editar plano da plataforma' })
  update(@Param('id') id: string, @Body() dto: UpdatePlatformPlanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] Desativar plano da plataforma' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@ApiTags('Platform Plans (SaaS B2B)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('arenas/:arenaId/subscription')
export class ArenaSubscriptionController {
  constructor(private readonly service: PlatformPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Ver a assinatura atual da arena com a plataforma Setto' })
  get(@Param('arenaId') arenaId: string) {
    return this.service.getArenaSubscription(arenaId);
  }

  @Post()
  @ApiOperation({ summary: 'Contratar um plano da plataforma Setto para a arena' })
  subscribe(@Param('arenaId') arenaId: string, @CurrentUser() user: any, @Body() dto: SubscribeToPlatformPlanDto) {
    return this.service.subscribeArena(arenaId, user, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Cancelar a assinatura da arena com a plataforma Setto' })
  cancel(@Param('arenaId') arenaId: string, @CurrentUser() user: any) {
    return this.service.cancelArenaSubscription(arenaId, user);
  }
}
