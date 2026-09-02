import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipPlansService } from './membership-plans.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto';

@ApiTags('Arena Membership Plans (Mensalidades)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('arenas/:arenaId/membership-plans')
export class MembershipPlansController {
  constructor(private readonly service: MembershipPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar planos de mensalidade da arena' })
  findAll(@Param('arenaId') arenaId: string, @Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(arenaId, includeInactive === 'true');
  }

  @Post()
  @ApiOperation({ summary: '[Staff/Dono] Criar plano de mensalidade' })
  create(@Param('arenaId') arenaId: string, @CurrentUser() user: any, @Body() dto: CreateMembershipPlanDto) {
    return this.service.create(arenaId, user, dto);
  }

  @Patch(':planId')
  @ApiOperation({ summary: '[Staff/Dono] Editar plano de mensalidade' })
  update(
    @Param('arenaId') arenaId: string,
    @Param('planId') planId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.service.update(arenaId, planId, user, dto);
  }

  @Delete(':planId')
  @ApiOperation({ summary: '[Staff/Dono] Desativar plano de mensalidade' })
  remove(@Param('arenaId') arenaId: string, @Param('planId') planId: string, @CurrentUser() user: any) {
    return this.service.remove(arenaId, planId, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Minhas mensalidades nesta arena' })
  myMemberships(@Param('arenaId') arenaId: string, @CurrentUser('id') userId: string) {
    return this.service.myMemberships(arenaId, userId);
  }

  @Post(':planId/subscribe')
  @ApiOperation({ summary: 'Assinar um plano de mensalidade (gera cobrança Pix/Cartão)' })
  subscribe(
    @Param('arenaId') arenaId: string,
    @Param('planId') planId: string,
    @CurrentUser() user: any,
    @Body() dto: SubscribeMembershipDto,
  ) {
    return this.service.subscribe(arenaId, planId, user, dto);
  }

  @Delete('memberships/:membershipId')
  @ApiOperation({ summary: 'Cancelar uma mensalidade ativa' })
  cancel(@Param('arenaId') arenaId: string, @Param('membershipId') membershipId: string, @CurrentUser() user: any) {
    return this.service.cancel(arenaId, membershipId, user);
  }
}
