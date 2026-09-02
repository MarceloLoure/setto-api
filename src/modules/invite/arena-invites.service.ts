import { 
  BadRequestException, 
  Injectable, 
  NotFoundException 
} from '@nestjs/common';
import { MailService } from 'src/email/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateArenaInviteDto } from 'src/super-admin/dto/create-arena-invite.dto';


@Injectable()
export class ArenaInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createAndSendInvite(dto: CreateArenaInviteDto) {
    const plan = await this.prisma.platformPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    // Define expiração para 7 dias a partir de hoje
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Cria o token no banco
    const invite = await this.prisma.arenaRegistrationToken.create({
      data: {
        email: dto.email,
        planId: dto.planId,
        expiresAt,
      },
    });

    // Dispara o e-mail via Resend
    await this.mailService.sendArenaInviteEmail(
      dto.email,
      invite.token,
      plan.name,
    );

    return {
      message: 'Convite enviado com sucesso!',
      tokenId: invite.id,
      expiresAt: invite.expiresAt,
    };
  }

  // Utilizado no frontend público para checar se o token da URL é válido
  async validateToken(token: string) {
    const invite = await this.prisma.arenaRegistrationToken.findUnique({
      where: { token },
      include: { plan: true },
    });

    if (!invite) {
      throw new NotFoundException('Token de convite inválido.');
    }

    if (invite.isUsed) {
      throw new BadRequestException('Este convite já foi utilizado.');
    }

    if (new Date() > invite.expiresAt) {
      throw new BadRequestException('Este convite já expirou.');
    }

    return {
      isValid: true,
      email: invite.email,
      plan: {
        id: invite.plan.id,
        name: invite.plan.name,
      },
    };
  }
}