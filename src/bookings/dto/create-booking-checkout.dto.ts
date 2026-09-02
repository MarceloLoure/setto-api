import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CreateBookingCheckoutDto {
  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD'], example: 'PIX' })
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType: 'PIX' | 'CREDIT_CARD';
}
