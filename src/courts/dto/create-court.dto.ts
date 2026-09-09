import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sport } from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Quadra 1 - Central Coberta' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da quadra é obrigatório' })
  name!: string;

  @ApiProperty({ enum: Sport, example: Sport.BEACH_TENNIS })
  @IsEnum(Sport, { message: 'Esporte inválido' })
  @IsNotEmpty()
  sport!: Sport;

  @ApiProperty({ example: 90.0, description: 'Valor da hora da quadra' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O valor da hora não pode ser negativo' })
  @IsNotEmpty()
  hourlyRate!: number;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCovered?: boolean = false;

  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @IsOptional()
  @IsUUID('4')
  arenaId?: string;

  // --- Especificações Físicas & Técnicas ---

  @ApiPropertyOptional({
    description: 'Tipo geral do piso ou superfície da quadra',
    example: 'Areia',
    default: 'Areia',
  })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({
    description: 'Detalhamento do material/areia da quadra',
    example: 'Areia de Quartzo Lavada (Atermica)',
  })
  @IsOptional()
  @IsString()
  surfaceNotes?: string;

  @ApiPropertyOptional({
    description: 'Altura da rede em metros',
    example: 1.7,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.5)
  @Max(3.0)
  netHeight?: number;

  @ApiPropertyOptional({
    description: 'Comprimento da quadra em metros',
    example: 16.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  lengthMeters?: number;

  @ApiPropertyOptional({
    description: 'Largura da quadra em metros',
    example: 8.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  widthMeters?: number;

  @ApiPropertyOptional({
    description: 'Possui iluminação para jogos noturnos',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @ApiPropertyOptional({
    description: 'Indica se possui dimensões oficiais do esporte',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isOfficialSize?: boolean;

  @ApiPropertyOptional({
    description: 'Observações e orientações gerais sobre a quadra',
    example:
      'Rede ajustável para Beach Tennis e Vôlei de Praia. Quadra localizada ao lado do bar.',
  })
  @IsOptional()
  @IsString()
  observation?: string;
}