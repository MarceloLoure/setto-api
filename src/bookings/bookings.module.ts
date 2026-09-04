import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingCronService } from './booking-cron.service';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [AsaasModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingCronService],
  exports: [BookingsService],
})
export class BookingsModule {}
