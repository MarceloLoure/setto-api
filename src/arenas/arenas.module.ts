import { Module } from '@nestjs/common';
import { ArenasController } from './arenas.controller';
import { ArenasService } from './arenas.service';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ArenasController],
  providers: [ArenasService],
  exports: [ArenasService],
})
export class ArenasModule {}
