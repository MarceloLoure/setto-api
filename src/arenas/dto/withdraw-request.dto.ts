import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class WithdrawRequestDto {
  @ApiProperty({ description: 'Valor para transferência/saque', example: 150.00 })
  @IsNumber()
  @IsPositive()
  value: number;

  @ApiPropertyOptional({ description: 'Chave Pix de destino (CPF, CNPJ, E-mail, Celular ou EVP)', example: '12345678900' })
  @IsOptional()
  @IsString()
  pixAddressKey?: string;
}