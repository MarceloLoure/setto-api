import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleArenaStatusDto {
  @ApiProperty({ example: false, description: 'Novo status da arena' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}