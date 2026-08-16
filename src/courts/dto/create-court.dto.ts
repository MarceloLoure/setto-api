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
}