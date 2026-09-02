import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

// A Asaas manda formatos ligeiramente diferentes por tipo de evento
// (payment.* vs subscription.*). Validamos os campos que realmente usamos e
// deixamos o restante do payload passar sem travar em decorators redundantes.
export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_DELETED'
  | string;

export class AsaasWebhookPaymentPayload {
  @IsString()
  @IsNotEmpty()
  id: string; // pay_xxxxxx

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  subscription?: string; // sub_xxxxxx, se originado de uma assinatura

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsNumber()
  @IsOptional()
  netValue?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  billingType: string;

  @IsString()
  @IsOptional()
  externalReference?: string | null;

  @IsString()
  @IsOptional()
  paymentDate?: string | null;

  @IsString()
  @IsOptional()
  confirmedDate?: string | null;
}

export class AsaasWebhookSubscriptionPayload {
  @IsString()
  @IsNotEmpty()
  id: string; // sub_xxxxxx

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  externalReference?: string | null;
}

export class AsaasWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: AsaasWebhookEvent;

  @ValidateNested()
  @Type(() => AsaasWebhookPaymentPayload)
  @IsOptional()
  payment?: AsaasWebhookPaymentPayload;

  @ValidateNested()
  @Type(() => AsaasWebhookSubscriptionPayload)
  @IsOptional()
  subscription?: AsaasWebhookSubscriptionPayload;
}
