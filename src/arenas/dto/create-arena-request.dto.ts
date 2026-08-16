import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateArenaRequestDto {
  @ApiProperty({ example: 'Arena Beach Social Londrina' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da arena é obrigatório' })
  name: string;

  @ApiPropertyOptional({ example: '12.345.678/0001-90' })
  @IsString()
  @IsOptional()
  cnpj?: string;

  @ApiPropertyOptional({ example: 'Av. Madre Leônia Milito' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '1500' })
  @IsString()
  @IsOptional()
  number?: string;

  @ApiPropertyOptional({ example: 'Bloco A' })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiPropertyOptional({ example: 'Gleba Fazenda Palhano' })
  @IsString()
  @IsOptional()
  neighborhood?: string;

  @ApiPropertyOptional({ example: '86050-270' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP em formato inválido' })
  zipCode?: string;

  @ApiProperty({ example: 'Londrina' })
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória' })
  city: string;

  @ApiProperty({ example: 'PR' })
  @IsString()
  @IsNotEmpty({ message: 'O estado é obrigatório' })
  state: string;
}