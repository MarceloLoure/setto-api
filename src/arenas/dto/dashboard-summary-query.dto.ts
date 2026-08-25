import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
 
export type DashboardPeriod = 'day' | 'week' | 'month';
 
export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    example: 'week',
    description: 'Granularidade do resumo. Padrão: week.',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: DashboardPeriod;
 
  @ApiPropertyOptional({
    example: '2026-08-25',
    description: 'Data de referência dentro do período (YYYY-MM-DD). Padrão: hoje.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
 