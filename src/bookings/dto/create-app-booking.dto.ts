import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID, ValidateIf, ValidateNested } from 'class-validator';
import { CreditCardDetailsDto } from 'src/asaas/dto/create-payment-split.dto';
import { CreditCardHolderInfoDto } from 'src/modules/public/dto/public-checkout.dto';

export enum AsaasBillingType {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
}

export class CreateAppBookingDto {
  @ApiProperty({ example: 'uuid-da-quadra' })
  @IsUUID('4', { message: 'courtId deve ser um UUID válido' })
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({ example: '2026-08-25T14:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '2026-08-25T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({ description: 'ID do cartão salvo no banco local (tabela CreditCard)' })
  @IsOptional()
  @IsUUID('4', { message: 'cardId deve ser um UUID v4 válido' })
  cardId?: string;

  @ApiProperty({ enum: AsaasBillingType, example: AsaasBillingType.PIX })
  @IsEnum(AsaasBillingType, { message: 'billingType deve ser PIX ou CREDIT_CARD' })
  @IsNotEmpty()
  billingType: AsaasBillingType;

  @ApiPropertyOptional({ description: 'Token de cartão de crédito pré-cadastrado no Asaas' })
  @IsOptional()
  creditCardToken?: string;

 @ApiPropertyOptional({ type: CreditCardDetailsDto })
  @ValidateIf((o) => o.billingType === AsaasBillingType.CREDIT_CARD && !o.creditCardToken && !o.cardId)
  @IsNotEmpty({ message: 'creditCard é obrigatório quando não informado um cartão salvo ou token' })
  @ValidateNested()
  @Type(() => CreditCardDetailsDto)
  creditCard?: CreditCardDetailsDto;

  // Dados do Titular do Cartão (obrigatório apenas se não houver cardId nem creditCardToken)
  @ApiPropertyOptional({ type: CreditCardHolderInfoDto })
  @ValidateIf((o) => o.billingType === AsaasBillingType.CREDIT_CARD && !o.creditCardToken && !o.cardId)
  @IsNotEmpty({ message: 'creditCardHolderInfo é obrigatório quando envia cartão novo' })
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;

  @ApiPropertyOptional({ description: 'Indica se deve tokenizar e salvar o cartão para uso futuro' })
  @IsBoolean()
  @IsOptional()
  saveCard?: boolean;


}