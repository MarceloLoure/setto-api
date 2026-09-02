import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMembershipPlanDto {
  @ApiProperty({ example: 'Mensalista Ouro — 2x por semana' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 249.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'] })
  @IsIn(['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'])
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY';
}
