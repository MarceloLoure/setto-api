import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: Role.ARENA_ADMIN })
  @IsEnum(Role, { message: 'Cargo inválido' })
  @IsNotEmpty({ message: 'O cargo é obrigatório' })
  role!: Role;

  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @IsOptional()
  @IsUUID('4', { message: 'arenaId deve ser um UUID válido' })
  arenaId?: string;
}