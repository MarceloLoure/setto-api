import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.RECEPTIONIST, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Lançar uma entrada financeira (agendamento ou avulsa)' })
  create(@Request() req, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(req.user, dto);
  }

  @Get('arena/:arenaId')
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.RECEPTIONIST, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Listar histórico de recebimentos da arena' })
  findByArena(@Request() req, @Param('arenaId') arenaId: string) {
    return this.paymentsService.findByArena(req.user, arenaId);
  }
}