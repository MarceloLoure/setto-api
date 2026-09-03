import {
  IsNotEmpty,
  IsString,
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

  account?: {
    id: string;
    ownerId?: string | null;
  };

  payment?: any;

  subscription?: any;
}