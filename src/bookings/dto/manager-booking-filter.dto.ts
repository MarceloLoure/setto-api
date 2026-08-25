import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, BookingType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ManagerBookingFilterDto {
  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @IsUUID('4')
  @IsOptional()
  arenaId?: string;

  @ApiPropertyOptional({ example: 'uuid-da-quadra' })
  @IsUUID('4')
  @IsOptional()
  courtId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ enum: BookingType })
  @IsEnum(BookingType)
  @IsOptional()
  type?: BookingType;

  @ApiPropertyOptional({ example: '2026-08-25T00:00:00.000Z', description: 'Data de início do grid' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-25T23:59:59.000Z', description: 'Data final do grid' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}