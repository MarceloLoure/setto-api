import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMembershipPlanDto } from './create-membership-plan.dto';

export class UpdateMembershipPlanDto extends PartialType(CreateMembershipPlanDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
