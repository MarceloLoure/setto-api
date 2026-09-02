import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { AsaasSplitConfig } from './create-payment-split.dto';
import type { AsaasBillingType } from './create-payment-split.dto';

export type AsaasSubscriptionCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'cus_000005113305' })
  @IsString()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED'] })
  @IsIn(['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED'])
  billingType: AsaasBillingType;

  @ApiProperty({ example: 99.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiProperty({ example: '2026-09-01', description: 'Vencimento da primeira cobrança, yyyy-MM-dd' })
  @IsString()
  @IsNotEmpty()
  nextDueDate: string;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'] })
  @IsIn(['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'])
  cycle: AsaasSubscriptionCycle;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'arena_sub:9b1e...',
    description: 'Convenção "<tipo>:<id-local>" ("arena_sub" ou "membership"), usada pelo webhook.',
  })
  @IsString()
  @IsNotEmpty()
  externalReference: string;

  @ApiPropertyOptional({
    type: [AsaasSplitConfig],
    description: 'Opcional: não se aplica a planos Setto (B2B) nem mensalidades de arena (B2C), que não têm split.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsaasSplitConfig)
  @IsOptional()
  split?: AsaasSplitConfig[];
}
