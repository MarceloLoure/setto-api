import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArenasModule } from './arenas/arenas.module';
import { CourtsModule } from './courts/courts.module';
import { BookingsModule } from './bookings/bookings.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { StaffModule } from './staff/staff.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HomeModule } from './home/home.module';
import { AsaasModule } from './asaas/asaas.module';
import { PaymentsModule } from './payments/payments.module';
import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ThrottlerModule.forRootAsync({
    //   useFactory: () => ({
    //     throttlers: [
    //       { name: 'default', ttl: 60000, limit: 100 },
    //       { name: 'strict', ttl: 60000, limit: 5 },
    //     ],
    //     // Conexão Redis compartilhada entre todas as réplicas
    //     storage: new ThrottlerStorageRedisService(
    //       new Redis(process.env.REDIS_URL || 'redis://localhost:6379'),
    //     ),
    //   }),
    // }),
    FirebaseModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 segundos
        limit: 100,  // Máximo 100 requisições por minuto por IP
      },
    ]),
    PrismaModule, AuthModule, HomeModule, UsersModule, ArenasModule, CourtsModule, BookingsModule, SuperAdminModule, StaffModule, PaymentsModule, AsaasModule, PublicModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService
  ],
})
export class AppModule {}
