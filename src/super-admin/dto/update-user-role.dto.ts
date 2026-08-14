import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: Role.ARENA_ADMIN })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ example: 'uuid-da-arena' })
  @IsString()
  @IsOptional()
  arenaId?: string;
}