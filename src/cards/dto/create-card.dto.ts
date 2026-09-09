import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { CreditCardDetailsDto, CreditCardHolderInfoDto } from 'src/asaas/dto/create-payment-split.dto';

export class CreateCardDto {
  @ApiProperty({ type: CreditCardDetailsDto })
  @ValidateNested()
  @Type(() => CreditCardDetailsDto)
  @IsNotEmpty()
  creditCard: CreditCardDetailsDto;

  @ApiProperty({ type: CreditCardHolderInfoDto })
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  @IsNotEmpty()
  creditCardHolderInfo: CreditCardHolderInfoDto;
}