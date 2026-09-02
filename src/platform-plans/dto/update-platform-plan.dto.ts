import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePlatformPlanDto } from './create-platform-plan.dto';

export class UpdatePlatformPlanDto extends PartialType(CreatePlatformPlanDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
