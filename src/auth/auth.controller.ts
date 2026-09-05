import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Manual User Registration (Email & Password)' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Social Login / Register (Google & Apple)' })
  @ApiResponse({ status: 200, description: 'Authenticated via Social Provider' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  socialLogin(@Body() socialDto: SocialLoginDto) {
    return this.authService.socialLogin(socialDto);
  }

  @Post('firebase')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login ou Cadastro via Firebase Auth (Google, Apple, etc.)' })
  @ApiResponse({ status: 200, description: 'Usuário autenticado com sucesso e token JWT retornado' })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado' })
  loginWithFirebase(@Body() dto: FirebaseLoginDto) {
    return this.authService.loginWithFirebase(dto.idToken);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User Login & Access Token Generation' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar redefinição de senha',
    description: 'Gera um token JWT temporário e envia por e-mail as instruções para redefinição de senha.',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      exemploPadrao: {
        summary: 'Exemplo de solicitação',
        value: {
          email: 'atleta@email.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Instruções de redefinição enviadas (ou aceitas com sucesso).',
    schema: {
      example: {
        message: 'Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'E-mail em formato inválido.' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redefinir a senha com o token',
    description: 'Valida o token JWT recebido no e-mail e atualiza a senha do usuário.',
  })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      exemploPadrao: {
        summary: 'Exemplo de redefinição de senha',
        value: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          password: 'NovaSenha#123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Senha redefinida com sucesso.',
    schema: {
      example: {
        message: 'Senha redefinida com sucesso!',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token de redefinição inválido, expirado ou senha fraca.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
