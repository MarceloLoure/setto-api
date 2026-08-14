import { PartialType } from '@nestjs/swagger';
import { CreateCourtDto } from './create-court.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCourtDto extends PartialType(CreateCourtDto) {
  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}