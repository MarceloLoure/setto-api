// user-payment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserPaymentDto {
  @ApiProperty({ example: 'pay_123456789' })
  id: string;

  @ApiProperty({ example: 150.0 })
  amount: number;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 'PIX' })
  billingType: string;

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: 'https://sandbox.asaas.com/i/12345', required: false })
  invoiceUrl?: string;

  @ApiProperty({ required: false })
  pixQrCode?: string;

  @ApiProperty({ required: false })
  pixCopiaECola?: string;
}