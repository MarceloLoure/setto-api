import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateArenaInviteDto {
  @ApiProperty({ example: 'dono.arena@email.com', description: 'E-mail do responsável pela arena' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'c0a80101-0000-0000-0000-000000000001', description: 'ID do plano assinado' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;
}