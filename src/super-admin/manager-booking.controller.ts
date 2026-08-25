import { Body, Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { ManagerBookingFilterDto } from 'src/bookings/dto/manager-booking-filter.dto';

@ApiTags('Manager - Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ARENA_ADMIN, Role.SUPERADMIN, Role.RECEPTIONIST, Role.TEACHER)
@Controller('manager/bookings')
export class ManagerBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar reserva de balcão, aula ou campeonato pela gestão' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createAdminBooking(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar agendamentos com detalhes completos de cliente, financeiro e participantes para a grade web',
  })
  findManagerBookings(
    @CurrentUser() user: any,
    @Query() filter: ManagerBookingFilterDto,
  ) {
    return this.bookingsService.findManagerBookings(user, filter);
  }
}