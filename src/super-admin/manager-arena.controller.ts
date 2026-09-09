import { Body, Controller, Param, Post, Put, UseGuards, Get, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ArenasService } from '../arenas/arenas.service';
import { UpdateOperatingHoursDto } from '../arenas/dto/update-operating-hours.dto';

@ApiTags('Manager - Arenas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ARENA_ADMIN, Role.SUPERADMIN) // Bloqueia Atletas comuns instantaneamente
@Controller('manager/arena')
export class ManagerArenaController {
  constructor(private readonly arenasService: ArenasService) {}

  @Get(':id/subscription')
  @ApiOperation({ summary: 'Consultar status e data de expiração da assinatura da arena' })
  getSubscription(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
  ) {
    return this.arenasService.getSubscriptionDetails(arenaId, user);
  }

  @Delete(':id/subscription')
  @ApiOperation({ summary: 'Cancelar assinatura recorrente da arena no Asaas' })
  cancelSubscription(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
  ) {
    return this.arenasService.cancelSubscription(arenaId, user);
  }

  @Put(':id/operating-hours')
  @ApiOperation({ summary: 'Configurar horários de abertura e fechamento por dia da semana' })
  updateHours(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateOperatingHoursDto,
  ) {
    return this.arenasService.updateOperatingHours(arenaId, user, dto);
  }

  @Post(':id/holidays')
  @ApiOperation({ summary: 'Bloquear uma data específica (Feriado ou Manutenção Geral)' })
  addHoliday(
    @Param('id') arenaId: string,
    @CurrentUser() user: any,
    @Body('date') date: string,
    @Body('description') description?: string,
  ) {
    return this.arenasService.addHoliday(arenaId, user, date, description);
  }
}