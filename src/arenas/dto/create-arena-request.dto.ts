import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateArenaRequestDto {
  @ApiProperty({ 
    example: 'c0a80101-0000-0000-0000-000000000001', 
    description: 'Token de convite gerado após a compra do plano' 
  })
  @IsUUID('4', { message: 'Token de convite inválido.' })
  @IsNotEmpty({ message: 'O token de convite é obrigatório.' })
  token: string;

  @ApiProperty({ example: 'Arena Beach Social Londrina' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '12.345.678/0001-90', required: false })
  @IsString()
  @IsOptional()
  cnpj?: string;

  @ApiProperty({ example: 'Av. Madre Leônia Milito' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: '1500' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ example: 'Bloco A', required: false })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiProperty({ example: 'Gleba Palhano' })
  @IsString()
  @IsNotEmpty()
  neighborhood: string;

  @ApiProperty({ example: '86050-270' })
  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @ApiProperty({ example: 'Londrina' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'PR' })
  @IsString()
  @IsNotEmpty()
  state: string;
}