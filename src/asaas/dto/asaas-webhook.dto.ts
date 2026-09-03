import {
  IsNotEmpty,
  IsString,
  IsOptional
} from 'class-validator';

export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_DELETED'
  | string;

export class AsaasWebhookDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  event: AsaasWebhookEvent;

  @IsString()
  @IsNotEmpty()
  dateCreated: string;

  @IsOptional()
  account?: {
    id: string;
    ownerId?: string | null;
  };

  @IsOptional()
  payment?: any;

  @IsOptional()
  subscription?: any;
}