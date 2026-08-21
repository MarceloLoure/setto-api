import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerActionType, BannerPosition } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateBannerDto {
  @ApiPropertyOptional({ example: 'Torneio Aberto de Beach Tennis' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ enum: BannerPosition, example: BannerPosition.HERO })
  @IsEnum(BannerPosition)
  position: BannerPosition;

  @ApiPropertyOptional({ enum: BannerActionType, example: BannerActionType.NONE })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(BannerActionType)
  @IsOptional()
  actionType?: BannerActionType;

  @ApiPropertyOptional({ example: 'uuid-da-arena-ou-link-externo' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  actionValue?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => (value === '' || value === undefined ? 1 : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID('4', { message: 'arenaId deve ser um UUID válido' })
  @IsOptional()
  arenaId?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'startDate deve ser uma data ISO 8601 válida' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.000Z' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'endDate deve ser uma data ISO 8601 válida' })
  @IsOptional()
  endDate?: string;
}