import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MinLength, ValidateIf, ValidateNested } from 'class-validator';

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

  @ApiProperty({ example: 'João da Silva' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'minha-senha-secreta' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password: string;

  @ApiPropertyOptional({ example: '+5543999999999' })
  @IsString()
  @IsOptional()
  phone?: string;
  
  @ApiPropertyOptional({
    example: '12345678901',
    description: 'CPF (apenas números ou formatado)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, {
    message: 'CPF deve estar em um formato válido (11 dígitos)',
  })
  cpf?: string;

  @ApiProperty({ example: 'contato@user.com.br' })
  @IsNotEmpty()
  @IsString()
  email: string;

   @ApiProperty({ example: 'contato@arena.com.br' })
  @IsNotEmpty()
  @IsString()
  arenaEmail: string;

  @ApiProperty({ example: '83873371000105' })
  @IsNotEmpty()
  @IsString()
  cpfCnpj: string;

  @ApiPropertyOptional({ example: 'Maringá' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'PR' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '87000000' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ enum: CheckoutBillingType, example: CheckoutBillingType.PIX })
  @IsNotEmpty()
  @IsEnum(CheckoutBillingType)
  billingType: CheckoutBillingType;

  @ApiPropertyOptional({ description: 'ID do cartão salvo na tabela CreditCard (se houver)' })
  @IsOptional()
  @IsUUID('4', { message: 'cardId deve ser um UUID v4 válido' })
  cardId?: string;

  @ApiPropertyOptional({ description: 'Token do cartão de crédito no Asaas' })
  @IsOptional()
  @IsString()
  creditCardToken?: string;

  @ApiPropertyOptional({ type: () => CreditCardDto })
  @ValidateIf((o) => o.billingType === CheckoutBillingType.CREDIT_CARD && !o.creditCardToken && !o.cardId)
  @IsNotEmpty({ message: 'creditCard é obrigatório quando não informado cartão salvo ou token' })
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @ApiPropertyOptional({ type: () => CreditCardHolderInfoDto })
  @ValidateIf((o) => o.billingType === CheckoutBillingType.CREDIT_CARD && !o.creditCardToken && !o.cardId)
  @IsNotEmpty({ message: 'creditCardHolderInfo é obrigatório quando envia cartão novo' })
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;
}