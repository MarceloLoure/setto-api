import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicCheckoutDto {
    @ApiProperty({
    description: 'ID do plano de plataforma selecionado',
    example: '6903ec8d-a6c1-468d-a5f4-ab628af3d588',
  })
  @IsUUID()
  @IsNotEmpty()
  platformPlanId: string;

    @ApiProperty({
    description: 'Nome da arena',
    example: 'Arena Beach Club',
  })
  @IsString()
  @IsNotEmpty()
  arenaName: string;

    @ApiProperty({
    description: 'E-mail do administrador da arena',
    example: 'exemple@mail.com'
    })
  @IsEmail()
  @IsNotEmpty()
  email: string;

    @ApiProperty({
    description: 'CPF ou CNPJ do administrador da arena',
    example: '12345678900'
  })
  @IsString()
  @IsNotEmpty()
  cpfCnpj: string;

    @ApiProperty({
    description: 'Cidade da arena',
    example: 'São Paulo'
  })
  @IsNotEmpty()
  @IsString()
  city: string;

    @ApiProperty({
    description: 'Estado da arena',
    example: 'SP'
  })
    @IsNotEmpty()
    @IsString()
    state: string;
}