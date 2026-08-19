import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAppBookingDto {
  @ApiProperty({ example: 'uuid-da-quadra' })
  @IsUUID('4', { message: 'courtId deve ser um UUID válido' })
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({ example: '2026-08-25T14:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '2026-08-25T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;
}