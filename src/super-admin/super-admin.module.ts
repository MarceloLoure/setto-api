import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { ArenasModule } from 'src/arenas/arenas.module';
import { BookingsModule } from 'src/bookings/bookings.module';
import { ManagerBookingController } from './manager-booking.controller';
import { ManagerArenaController } from './manager-arena.controller';
import { ManagerHomeController } from './manager-home.controller';
import { HomeModule } from 'src/home/home.module';
import { PlatformPlansService } from './platform-plans.service';
import { PlatformPlansController } from './platform-plans.controller';
import { MailModule } from 'src/email/mail.module';
import { ArenaInvitesService } from 'src/modules/invite/arena-invites.service';
import { PublicInvitesController } from 'src/modules/public/public-register-admin.controller';

@Module({
  imports: [ArenasModule, BookingsModule, HomeModule, MailModule],
  controllers: [
    SuperAdminController,
    ManagerArenaController,
    ManagerBookingController,
    ManagerHomeController,
    PlatformPlansController,
    PublicInvitesController
  ],
  providers: [SuperAdminService, PlatformPlansService, ArenaInvitesService],
  exports: [PlatformPlansService]
})
export class SuperAdminModule {}
