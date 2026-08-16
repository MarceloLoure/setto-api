import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-da-quadra' })
  @IsUUID('4', { message: 'ID da quadra inválido' })
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({ example: '2026-08-20T14:00:00.000Z' })
  @IsDateString({}, { message: 'Data de início inválida' })
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '2026-08-20T15:00:00.000Z' })
  @IsDateString({}, { message: 'Data de término inválida' })
  @IsNotEmpty()
  endTime: string;

  // Permitido apenas para staff (criação balcão/presencial)
  @ApiPropertyOptional({ example: 'uuid-do-cliente', description: 'Uso exclusivo de staff' })
  @IsUUID('4')
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'Carlos Cliente Balcão' })
  @IsString()
  @IsOptional()
  customerName?: string;
}