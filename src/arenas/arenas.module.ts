import { Module } from '@nestjs/common';
import { ArenasService } from './arenas.service';
import { StorageModule } from 'src/storage/storage.module';
import { AuthModule } from 'src/auth/auth.module';
import { AsaasModule } from '../asaas/asaas.module';
import { ArenasController } from './arenas.controller';

@Module({
  imports: [StorageModule, AuthModule, AsaasModule],
  controllers: [ArenasController],
  providers: [ArenasService],
  exports: [ArenasService],
})
export class ArenasModule {}
