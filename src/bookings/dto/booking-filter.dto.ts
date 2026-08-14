import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class BookingFilterDto {
  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @IsString()
  @IsOptional()
  arenaId?: string;

  @ApiPropertyOptional({ example: 'uuid-da-quadra' })
  @IsString()
  @IsOptional()
  courtId?: string;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsDateString()
  @IsOptional()
  date?: string;
}