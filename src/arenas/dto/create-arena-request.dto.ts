import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateArenaRequestDto {
  @ApiProperty({ example: 'Arena Beach Social Londrina' })
  @IsString()
  @IsNotEmpty()
  arenaName: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty()
  cnpj: string; // CNPJ

  @ApiPropertyOptional({ example: 'Av. Brasil, 1000' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Londrina' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'PR' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: '+5543999999999' })
  @IsString()
  @IsOptional()
  phone?: string;
}