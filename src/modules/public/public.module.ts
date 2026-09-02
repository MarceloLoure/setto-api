import { Module } from '@nestjs/common';
import { PublicPlansController } from './public-plans.controller';
import { SuperAdminModule } from '../../super-admin/super-admin.module';
import { PublicInvitesController } from './public-register-admin.controller';
import { ArenaInvitesModule } from '../invite/arena-invite.module';

@Module({
  imports: [SuperAdminModule, ArenaInvitesModule],
  controllers: [PublicPlansController, PublicInvitesController],
})
export class PublicModule {}