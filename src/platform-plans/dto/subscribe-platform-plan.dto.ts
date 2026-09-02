import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SubscribeToPlatformPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  platformPlanId: string;

  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD'], example: 'PIX' })
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType: 'PIX' | 'CREDIT_CARD';
}
