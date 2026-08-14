import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateInviteDto {
  @ApiProperty({
    example: 'funcionario@email.com',
    description: 'E-mail do usuário que receberá o convite para a equipe',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: [Role.RECEPTIONIST, Role.TEACHER],
    example: Role.RECEPTIONIST,
    description: 'Cargo a ser atribuído na arena (RECEPTIONIST ou TEACHER)',
  })
  @IsEnum(Role, { message: 'O cargo deve ser RECEPTIONIST ou TEACHER' })
  @IsNotEmpty()
  role: Role;

  @ApiProperty({
    example: 'b73fade9-4b38-4fd9-8d0b-7502751a18d3',
    description: 'ID da arena para a qual o convite está sendo enviado',
  })
  @IsUUID()
  @IsNotEmpty()
  arenaId: string;
}