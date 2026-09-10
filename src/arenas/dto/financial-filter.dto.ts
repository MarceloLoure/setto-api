import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class FinancialFilterDto {
  @ApiPropertyOptional({ description: 'Data inicial (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Filtrar por status do pagamento' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}