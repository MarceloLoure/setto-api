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
import { CreateBookingCheckoutDto } from './dto/create-booking-checkout.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AppBookingResponseDto } from './dto/app-booking-response.dto';

@ApiTags('Bookings (App Atleta)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar reserva rápida de quadra pelo App e gerar cobrança (Pix/Cartão)' })
  @ApiResponse({
    status: 201,
    description: 'Reserva temporária (PENDING com TTL de 30m) criada com sucesso e cobrança emitida.',
    type: AppBookingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou Arena não aceita pagamento online.' })
  @ApiResponse({ status: 409, description: 'Horário já reservado por outro usuário.' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateAppBookingDto,
  ) {
    return this.bookingsService.createAppBooking(user, dto);
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Gerar cobrança online (Pix/Cartão) de uma reserva pendente' })
  checkout(
    @Param('id') bookingId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateBookingCheckoutDto,
  ) {
    return this.bookingsService.initiateCheckout(user, bookingId, dto);
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