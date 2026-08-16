import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sport } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export class FindArenaAvailabilityQueryDto {
  @ApiProperty({
    example: '2026-08-20',
    description: 'Data desejada para reserva (formato YYYY-MM-DD)',
  })
  @IsDateString({}, { message: 'Data informada inválida. Use o formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'A data da consulta é obrigatória' })
  date!: string;

  @ApiPropertyOptional({
    enum: Sport,
    description: 'Filtrar disponibilidade por esporte',
  })
  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  @ApiPropertyOptional({
    example: 60,
    default: 60,
    description: 'Duração do slot em minutos (mínimo 30, padrão 60)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(180)
  @IsOptional()
  slotDurationMinutes?: number = 60;
}