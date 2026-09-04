import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum CheckoutBillingType {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
}

export class CreditCardDto {
  @ApiProperty({ example: 'JOAO SILVA' })
  @IsNotEmpty()
  @IsString()
  holderName: string;

  @ApiProperty({ example: '4532111122223333' })
  @IsNotEmpty()
  @IsString()
  number: string;

  @ApiProperty({ example: '12' })
  @IsNotEmpty()
  @IsString()
  expiryMonth: string;

  @ApiProperty({ example: '2028' })
  @IsNotEmpty()
  @IsString()
  expiryYear: string;

  @ApiProperty({ example: '123' })
  @IsNotEmpty()
  @IsString()
  ccv: string;
}

export class CreditCardHolderInfoDto {
  @ApiPropertyOptional({ example: 'Joao Silva' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '87000000' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: '123' })
  @IsOptional()
  @IsString()
  addressNumber?: string;
}

export class PublicCheckoutDto {
  @ApiProperty({ example: '6903ec8d-a6c1-468d-a5f4-ab628af3d588' })
  @IsNotEmpty()
  @IsString()
  platformPlanId: string;

  @ApiProperty({ example: 'Arena Beach Social' })
  @IsNotEmpty()
  @IsString()
  arenaName: string;

  @ApiProperty({ example: 'contato@arena.com.br' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ example: '83873371000105' })
  @IsNotEmpty()
  @IsString()
  cpfCnpj: string;

  @ApiPropertyOptional({ example: '43999999999' })
  @IsOptional()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Maringá' })
  @IsOptional()
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'PR' })
  @IsOptional()
  @IsString()
  state: string;

  @ApiPropertyOptional({ example: '87000000' })
  @IsOptional()
  @IsString()
  zipCode: string;

  @ApiProperty({ enum: CheckoutBillingType, example: CheckoutBillingType.PIX })
  @IsNotEmpty()
  @IsEnum(CheckoutBillingType)
  billingType: CheckoutBillingType;

  @ApiPropertyOptional({ type: () => CreditCardDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @ApiPropertyOptional({ type: () => CreditCardHolderInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;
}