import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AsaasService } from './asaas.service';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { AsaasWebhookService } from './asaas-webhook.service';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AsaasWebhookController],
  providers: [AsaasService, AsaasWebhookService, SubscriptionGuard],
  exports: [AsaasService, SubscriptionGuard],
})
export class AsaasModule {}
