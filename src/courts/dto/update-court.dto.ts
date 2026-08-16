import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCourtDto } from './create-court.dto';

export class UpdateCourtDto extends PartialType(CreateCourtDto) {
  @ApiPropertyOptional({ example: true, description: 'Status de ativação da quadra' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}