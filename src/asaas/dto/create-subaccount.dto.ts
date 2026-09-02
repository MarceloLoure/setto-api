import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubaccountDto {
  @ApiProperty({ example: 'Arena Beach Tennis Ltda' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'financeiro@arena.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12345678000199' })
  @IsString()
  @IsNotEmpty()
  cpfCnpj: string;

  @ApiPropertyOptional({ enum: ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'] })
  @IsIn(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'])
  @IsOptional()
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mobilePhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressNumber?: string;

  @ApiPropertyOptional({ description: 'Bairro' })
  @IsString()
  @IsOptional()
  province?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  postalCode?: string;
}
