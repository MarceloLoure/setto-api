import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { ArenasModule } from 'src/arenas/arenas.module';
import { BookingsModule } from 'src/bookings/bookings.module';
import { ManagerBookingController } from './manager-booking.controller';
import { ManagerArenaController } from './manager-arena.controller';
import { ManagerHomeController } from './manager-home.controller';
import { HomeModule } from 'src/home/home.module';

@Module({
  imports: [ArenasModule, BookingsModule, HomeModule],
  controllers: [
    SuperAdminController,
    ManagerArenaController,
    ManagerBookingController,
    ManagerHomeController
  ],
  providers: [SuperAdminService]
})
export class SuperAdminModule {}
