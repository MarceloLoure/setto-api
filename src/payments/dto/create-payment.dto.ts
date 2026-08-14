import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentCategory, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({
    example: 'Aluguel Quadra 1 - Beach Tennis',
    description: 'Descrição ou identificação da entrada financeira',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: 120.0,
    description: 'Valor total do pagamento',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'O valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
    description: 'Forma de pagamento utilizada',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    enum: PaymentCategory,
    example: PaymentCategory.BOOKING,
    description: 'Categoria do lançamento financeiro',
  })
  @IsEnum(PaymentCategory)
  @IsOptional()
  category?: PaymentCategory;

  @ApiProperty({
    example: 'b73fade9-4b38-4fd9-8d0b-7502751a18d3',
    description: 'ID da arena onde o pagamento está sendo registrado',
  })
  @IsUUID()
  @IsNotEmpty()
  arenaId: string;

  @ApiPropertyOptional({
    example: '18629cbc-b094-4b2e-a032-f0ebba95f9c1',
    description: 'ID do agendamento vinculado (se houver)',
  })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiPropertyOptional({
    example: '693a44a8-edc8-491b-b371-e47cae176513',
    description: 'ID do atleta/cliente que efetuou o pagamento (se houver)',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}