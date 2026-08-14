import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    example: '18629cbc-b094-4b2e-a032-f0ebba95f9c1',
    description: 'ID da quadra',
  })
  @IsUUID()
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({
    example: 'b73fade9-4b38-4fd9-8d0b-7502751a18d3',
    description: 'ID da arena',
  })
  @IsUUID()
  @IsNotEmpty()
  arenaId: string;

  @ApiProperty({
    example: '2026-08-20T18:00:00.000Z',
    description: 'Horário de início da reserva (ISO String)',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    example: '2026-08-20T19:00:00.000Z',
    description: 'Horário de término da reserva (ISO String)',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({
    example: 80.0,
    description: 'Valor total da reserva',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount: number;

  @ApiPropertyOptional({
    example: '693a44a8-edc8-491b-b371-e47cae176513',
    description: 'ID do usuário/atleta (se for cadastrado no app)',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: 'João da Silva (WhatsApp)',
    description: 'Nome do cliente avulso / balcão (sem conta no app)',
  })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({
    example: '+5543999999999',
    description: 'Telefone do cliente avulso para contato',
  })
  @IsString()
  @IsOptional()
  customerPhone?: string;
}