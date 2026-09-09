import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';

export class CreditCardHolderInfoDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12345678909' })
  @IsString()
  @IsNotEmpty()
  cpfCnpj: string;

  @ApiProperty({ example: '01310100' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: '1000' })
  @IsString()
  @IsNotEmpty()
  addressNumber: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class CreditCardDetailsDto {
  @ApiProperty({ example: 'JOAO SILVA' })
  @IsString()
  @IsNotEmpty()
  holderName: string;

  @ApiProperty({ example: '4444567890123456' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @IsNotEmpty()
  expiryMonth: string;

  @ApiProperty({ example: '2028' })
  @IsString()
  @IsNotEmpty()
  expiryYear: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @IsNotEmpty()
  ccv: string;
}

export class AsaasSplitConfig {
  @ApiProperty({ example: 'wal_master_xxxxxx', description: 'Carteira Asaas que recebe esta parte do split' })
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @ApiPropertyOptional({ description: 'Valor fixo em R$ destinado a esta carteira' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  fixedValue?: number;

  @ApiPropertyOptional({ description: 'Percentual (0-100) destinado a esta carteira' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  percentualValue?: number;
}

export class CreatePaymentSplitDto {
  @ApiProperty({ example: 'cus_000005113305', description: 'ID do cliente Asaas' })
  @IsString()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED'] })
  @IsIn(['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED'])
  billingType: AsaasBillingType;

  @ApiProperty({ example: 120.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiProperty({ example: '2026-08-30', description: 'Vencimento no formato yyyy-MM-dd' })
  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'booking:18629cbc-b094-4b2e-a032-f0ebba95f9c1',
    description: 'Convenção "<tipo>:<id-local>", usada pelo webhook pra casar a cobrança de volta com o registro.',
  })
  @IsString()
  @IsNotEmpty()
  externalReference: string;

  @ApiProperty({ type: [AsaasSplitConfig] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsaasSplitConfig)
  split: AsaasSplitConfig[];

  @ApiPropertyOptional({
    example: 'tok_000005113305',
    description: 'Token de cartão de crédito pré-cadastrado no Asaas',
  })
  @IsString()
  @IsOptional()
  creditCardToken?: string;

  @ApiPropertyOptional({ type: CreditCardDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDetailsDto)
  creditCard?: CreditCardDetailsDto;

  @ApiPropertyOptional({ type: CreditCardHolderInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;

  @ApiPropertyOptional({ description: 'Indica se deve tokenizar o cartão no Asaas para compras futuras' })
  @IsBoolean()
  @IsOptional()
  saveCard?: boolean;
}
