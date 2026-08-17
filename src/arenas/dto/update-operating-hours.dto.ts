import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DayScheduleDto {
  @ApiProperty({ example: 1, description: '0 (Domingo) a 6 (Sábado)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '06:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'openTime deve estar no formato HH:mm',
  })
  openTime: string;

  @ApiProperty({ example: '23:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closeTime deve estar no formato HH:mm',
  })
  closeTime: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isOpen: boolean;
}

export class UpdateOperatingHoursDto {
  @ApiProperty({ type: [DayScheduleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  schedules: DayScheduleDto[];
}

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: 'Feriado de Natal' })
  @IsOptional()
  @IsString()
  description?: string;
}