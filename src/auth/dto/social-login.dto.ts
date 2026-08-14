import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ example: 'google', description: 'Provider name: google or apple' })
  @IsString()
  @IsNotEmpty()
  provider: 'google' | 'apple';

  @ApiProperty({ example: '1122334455667788' })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({ example: 'marcelo@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Marcelo Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/a/...' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}