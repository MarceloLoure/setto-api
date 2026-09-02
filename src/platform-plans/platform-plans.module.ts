import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';
import { PlatformPlansService } from './platform-plans.service';
import { PlatformPlansController, ArenaSubscriptionController } from './platform-plans.controller';

@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [PlatformPlansController, ArenaSubscriptionController],
  providers: [PlatformPlansService],
  exports: [PlatformPlansService],
})
export class PlatformPlansModule {}
