import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AsaasWebhookService } from './asaas-webhook.service';
import { AsaasWebhookDto } from './dto/asaas-webhook.dto';

@ApiExcludeController()
@Controller('asaas/webhooks')
export class AsaasWebhookController {
  constructor(
    private readonly webhookService: AsaasWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  async handle(@Headers('asaas-access-token') token: string, @Body() payload: AsaasWebhookDto) {
    const expectedToken = this.config.get<string>('ASAAS_WEBHOOK_SECRET');
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Token de webhook inválido.');
    }

    await this.webhookService.processEvent(payload);
    return { received: true };
  }
}