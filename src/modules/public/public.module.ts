import { Module } from '@nestjs/common';
import { PublicPlansController } from './public-plans.controller';
import { SuperAdminModule } from '../../super-admin/super-admin.module';
import { PublicInvitesController } from './public-register-admin.controller';
import { ArenaInvitesModule } from '../invite/arena-invite.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PublicCheckoutService } from './public-checkout.service';

@Module({
  imports: [SuperAdminModule, ArenaInvitesModule, PrismaModule],
  controllers: [PublicPlansController, PublicInvitesController],
  providers: [
    PublicCheckoutService,
  ]
})
export class PublicModule {}