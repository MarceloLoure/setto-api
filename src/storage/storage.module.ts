import { Global, Module } from '@nestjs/common';
import { FirebaseStorageService } from './storage.service';

@Global()
@Module({
  providers: [FirebaseStorageService],
  exports: [FirebaseStorageService],
})
export class StorageModule {}