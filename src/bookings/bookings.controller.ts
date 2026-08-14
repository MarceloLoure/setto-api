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
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a court booking with conflict check' })
  @ApiResponse({ status: 201, description: 'Booking successfully confirmed' })
  @ApiResponse({ status: 409, description: 'Court already booked for this interval' })
  create(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings filtered by user role and court/arena parameters' })
  findAll(@Request() req, @Query() filter: BookingFilterDto) {
    return this.bookingsService.findAll(req.user, filter);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an existing booking' })
  cancel(@Param('id') bookingId: string, @Request() req) {
    return this.bookingsService.cancel(bookingId, req.user);
  }
}