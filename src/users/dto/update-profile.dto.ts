import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Marcelo Silva' })
  @IsString()
  @IsOptional()
  name?: string;

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

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.MALE,
    description: 'Gênero do usuário (MALE, FEMALE, OTHER)',
  })
  @IsEnum(Gender, { message: 'O gênero deve ser MALE, FEMALE ou OTHER' })
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    example: '1995-08-20',
    description: 'Data de nascimento (YYYY-MM-DD ou ISO 8601)',
  })
  @IsDateString({}, { message: 'Informe uma data de nascimento válida' })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Londrina' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'PR' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'Atleta amador de Beach Tennis cat C' })
  @IsString()
  @IsOptional()
  bio?: string;
}