import { Module } from '@nestjs/common';
import { ArenaInvitesService } from './arena-invites.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/email/mail.module';

@Module({
    imports: [PrismaModule, MailModule],
  providers: [ArenaInvitesService],
  exports: [ArenaInvitesService],
})
export class ArenaInvitesModule {}