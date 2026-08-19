import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateAppBookingDto } from './dto/create-app-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Bookings (App Atleta)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar reserva rápida de quadra pelo App' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateAppBookingDto,
  ) {
    return this.bookingsService.createAppBooking(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar agendamentos do atleta logado' })
  findAll(
    @CurrentUser() user: any,
    @Query() filter: BookingFilterDto,
  ) {
    return this.bookingsService.findAll(user, filter);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar agendamento' })
  cancel(@Param('id') bookingId: string, @CurrentUser() user: any) {
    return this.bookingsService.cancel(bookingId, user);
  }
}