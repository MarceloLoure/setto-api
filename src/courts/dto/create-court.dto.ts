import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sport } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Quadra 1 - Coberta' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Sport, example: Sport.BEACH_TENNIS })
  @IsEnum(Sport)
  @IsNotEmpty()
  sport: Sport;

  @ApiProperty({ example: 80.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsNotEmpty()
  hourlyRate: number;

  @ApiPropertyOptional({ example: true, default: false })
  @IsBoolean()
  @IsOptional()
  isCovered?: boolean;

  @ApiPropertyOptional({ example: 'uuid-da-arena-opcional-para-superadmin' })
  @IsString()
  @IsOptional()
  arenaId?: string;
}