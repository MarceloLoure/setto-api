import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ enum: BookingType, example: BookingType.FREE_PLAY })
  @IsEnum(BookingType)
  @IsNotEmpty()
  type: BookingType;

  @ApiProperty({ example: 'uuid-da-quadra' })
  @IsUUID('4')
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({ example: '2026-08-25T14:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '2026-08-25T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  // --- Específico para Aulas Coletivas / Com Professor ---
  @ApiPropertyOptional({ example: 'uuid-do-professor' })
  @ValidateIf((o) => o.type === BookingType.SINGLE_LESSON || o.type === BookingType.GROUP_LESSON)
  @IsUUID('4')
  @IsOptional()
  coachId?: string;

  @ApiPropertyOptional({ example: 45.0, description: 'Preço por atleta para aula coletiva' })
  @ValidateIf((o) => o.type === BookingType.GROUP_LESSON)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  pricePerPlayer?: number;

  @ApiPropertyOptional({ example: 4, description: 'Limite máximo de atletas' })
  @ValidateIf((o) => o.type === BookingType.GROUP_LESSON)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxPlayers?: number;

  @ApiPropertyOptional({ description: 'IDs de atletas inscritos na criação' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  participantIds?: string[];

  // --- Específico para Aula Fixa (Recorrente) ---
  @ApiPropertyOptional({ example: true })
  @ValidateIf((o) => o.type === BookingType.RECURRING_LESSON)
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Até quando a aula se repete' })
  @ValidateIf((o) => o.type === BookingType.RECURRING_LESSON)
  @IsDateString()
  @IsOptional()
  recurrenceEnd?: string;

  // --- Específico para Campeonato / Balcão ---
  @ApiPropertyOptional({ example: 'Torneio Aberto de Inverno' })
  @ValidateIf((o) => o.type === BookingType.TOURNAMENT)
  @IsString()
  @IsOptional()
  tournamentName?: string;

  @ApiPropertyOptional({ example: 'uuid-do-atleta' })
  @IsUUID('4')
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'Carlos Cliente Balcão' })
  @IsString()
  @IsOptional()
  customerName?: string;
}