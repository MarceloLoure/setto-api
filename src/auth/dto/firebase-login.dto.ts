import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FirebaseLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Token JWT emitido pelo Firebase Authentication no frontend',
  })
  @IsString()
  @IsNotEmpty({ message: 'O idToken do Firebase é obrigatório' })
  idToken: string;
}