import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HomeService } from './home.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}