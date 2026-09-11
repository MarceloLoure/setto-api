import { Module } from '@nestjs/common';
import { PublicPlansController } from './public-plans.controller';
import { SuperAdminModule } from '../../super-admin/super-admin.module';
import { PublicInvitesController } from './public-register-admin.controller';
import { ArenaInvitesModule } from '../invite/arena-invite.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PublicCheckoutService } from './public-checkout.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SuperAdminModule, ArenaInvitesModule, PrismaModule, AuthModule],
  controllers: [PublicPlansController, PublicInvitesController],
  providers: [
    PublicCheckoutService,
  ]
})
export class PublicModule {}