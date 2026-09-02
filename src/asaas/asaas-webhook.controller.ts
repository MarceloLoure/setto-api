import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AsaasWebhookService } from './asaas-webhook.service';
import { AsaasWebhookDto } from './dto/asaas-webhook.dto';

// Endpoint público (sem JwtAuthGuard) — a autenticação aqui é feita pelo
// token compartilhado configurado no painel da Asaas, não por JWT de usuário.
@ApiExcludeController()
@Controller('asaas/webhooks')
export class AsaasWebhookController {
  constructor(
    private readonly webhookService: AsaasWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Headers('asaas-access-token') token: string, @Body() payload: AsaasWebhookDto) {
    const expectedToken = this.config.get<string>('ASAAS_WEBHOOK_SECRET');
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Token de webhook inválido.');
    }

    await this.webhookService.processEvent(payload);
    // A Asaas espera um 200 simples pra considerar o evento entregue.
    return { received: true };
  }
}
