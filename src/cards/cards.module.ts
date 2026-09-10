import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { AsaasModule } from 'src/asaas/asaas.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [
        AsaasModule, 
        PrismaModule,
    ],
    controllers: [CardsController],
    providers: [CardsService],
    exports: [CardsService],
})
export class CardsModule {}