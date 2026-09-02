import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';
import { MembershipPlansService } from './membership-plans.service';
import { MembershipPlansController } from './membership-plans.controller';

@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [MembershipPlansController],
  providers: [MembershipPlansService],
  exports: [MembershipPlansService],
})
export class MembershipPlansModule {}
