import { PartialType } from '@nestjs/mapped-types';
import { CreatePlatformPlanDto } from './create-platform-plan.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePlatformPlanDto extends PartialType(CreatePlatformPlanDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}