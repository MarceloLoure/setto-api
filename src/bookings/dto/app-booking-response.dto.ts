import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AsaasBillingType } from './create-app-booking.dto';

export class PixQrCodeDto {
  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' })
  encodedImage: string;

  @ApiProperty({ example: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000...' })
  payload: string;

  @ApiProperty({ example: '2026-08-29T14:30:00.000Z' })
  expirationDate: string;
}

export class AppBookingPaymentDetailsDto {
  @ApiProperty({ example: 'pay_123456789' })
  asaasPaymentId: string;

  @ApiProperty({ enum: AsaasBillingType, example: AsaasBillingType.PIX })
  billingType: AsaasBillingType;

  @ApiPropertyOptional({ type: PixQrCodeDto, description: 'Presente se billingType for PIX' })
  pix?: PixQrCodeDto;

  @ApiPropertyOptional({ 
    example: 'https://www.asaas.com/i/123456789', 
    description: 'URL da fatura/checkout Asaas se billingType for CREDIT_CARD' 
  })
  invoiceUrl?: string;
}

export class AppBookingResponseDto {
  @ApiProperty({ description: 'Dados da reserva criada' })
  booking: any;

  @ApiProperty({ type: AppBookingPaymentDetailsDto, description: 'Dados do pagamento (Pix ou Cartão)' })
  payment: AppBookingPaymentDetailsDto;

  @ApiProperty({ example: '2026-08-29T14:30:00.000Z', description: 'Data/Hora de expiração do bloqueio de 30min' })
  expiresAt: string;
}