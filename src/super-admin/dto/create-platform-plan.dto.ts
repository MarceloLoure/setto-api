import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PlanBillingCycle } from '@prisma/client';

export class CreatePlatformPlanDto {
  @ApiProperty({ example: 'Plano Pro', description: 'Nome do plano do SaaS' })
  @IsString()
  @IsNotEmpty({ message: 'O nome do plano é obrigatório.' })
  name: string;

  @ApiPropertyOptional({ example: 'Acesso completo a todas as quadras', description: 'Descrição detalhada do plano' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 199.90, description: 'Preço da assinatura mensal ou anual' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'O preço deve ser um valor positivo.' })
  price: number;

  @ApiProperty({ enum: PlanBillingCycle, example: PlanBillingCycle.MONTHLY, description: 'Ciclo de cobrança do plano' })
  @IsEnum(PlanBillingCycle, { message: 'Ciclo de cobrança inválido.' })
  billingCycle: PlanBillingCycle;

  @ApiPropertyOptional({ example: 5, description: 'Limite máximo de quadras cadastradas (null para ilimitado)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxCourts?: number;

  @ApiPropertyOptional({ example: 3, description: 'Limite máximo de funcionários (null para ilimitado)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxStaff?: number;
}