import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlatformPlanDto {
  @ApiProperty({ example: 'Pro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 199.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'] })
  @IsIn(['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'])
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY';

  @ApiPropertyOptional({ description: 'Limite de quadras (vazio = ilimitado)' })
  @IsInt()
  @IsOptional()
  maxCourts?: number;

  @ApiPropertyOptional({ description: 'Limite de funcionários (vazio = ilimitado)' })
  @IsInt()
  @IsOptional()
  maxStaff?: number;
}
