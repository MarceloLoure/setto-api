import { ConflictException, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { Role } from '@prisma/client';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MailService } from 'src/email/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
    private mailService: MailService,
  ) {}

  // Cadastro Manual (E-mail + Senha)
  async register(registerDto: RegisterDto) {
    const { email, password, name, phone } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'ATHLETE',
      },
      include: {
        avatar: { select: { id: true, name: true, path: true } },
        arenasManaged: {
          select: { id: true, name: true, courts: { select: { id: true, name: true, sport: true } } },
        },
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isManager: user.arenasManaged.length > 0 || user.role === Role.SUPERADMIN,
      },
    };
  }

  // Login e Registro Social (Google & Apple)
  async socialLogin(socialDto: SocialLoginDto) {
    const { provider, providerId, email, name, avatarUrl } = socialDto;

    const providerField = provider === 'google' ? { googleId: providerId } : { appleId: providerId };

    // 1. Procura usuário pelo ID do Provedor Social
    let user = await this.prisma.user.findFirst({
      where: providerField,
      include: {
        avatar: { select: { id: true, name: true, path: true } },
        arenasManaged: {
          select: { id: true, name: true, courts: { select: { id: true, name: true, sport: true } } },
        },
      },
    });

    // 2. Se não achou pelo ID social, tenta vínculo pelo E-mail
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          avatar: { select: { id: true, name: true, path: true } },
          arenasManaged: {
            select: { id: true, name: true, courts: { select: { id: true, name: true, sport: true } } },
          },
        },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...providerField,
            ...(avatarUrl &&
              !user.avatar && {
                avatar: {
                  create: {
                    name: 'oauth-avatar.jpg',
                    path: avatarUrl,
                  },
                },
            }),
          },
          include: {
            avatar: { select: { id: true, name: true, path: true } },
            arenasManaged: {
              select: { id: true, name: true, courts: { select: { id: true, name: true, sport: true } } },
            },
          },
        });
      }
    }

    // 3. Se usuário não existe, cria um novo
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          ...providerField,
          role: 'ATHLETE',
          ...(avatarUrl && {
            avatar: {
              create: {
                name: 'oauth-avatar.jpg',
                path: avatarUrl,
              },
            },
          }),
        },
        include: {
          avatar: { select: { id: true, name: true, path: true } },
          arenasManaged: {
            select: { id: true, name: true, courts: { select: { id: true, name: true, sport: true } } },
          },
        },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isManager: user.arenasManaged.length > 0 || user.role === Role.SUPERADMIN,
      },
    };
  }

  // Exemplo de método dentro do AuthService
    async loginWithFirebase(idToken: string) {
    // 1. Valida com o Firebase Admin
    const decodedToken = await this.firebaseService.verifyIdToken(idToken);
    const { email, name, picture, uid } = decodedToken;

    if (!email) {
        throw new BadRequestException('E-mail não fornecido pelo provedor OAuth');
    }

    // 2. Busca ou Cria o usuário no PostgreSQL
    let user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          avatar: { select: { id: true, name: true, path: true } },
          arenasManaged: { select: { id: true, name: true } },
        },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: name || 'Atleta',
          googleId: uid,
          role: "ATHLETE",
          ...(picture && {
            avatar: {
              create: {
                name: 'firebase-avatar.jpg',
                path: picture,
              },
            },
          }),
        },
        include: {
          avatar: { select: { id: true, name: true, path: true } },
          arenasManaged: { select: { id: true, name: true } },
        },
      });
    }

    // 3. Emite o JWT padrão da sua API
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
        accessToken: this.jwtService.sign(payload),
        user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isManager: user.arenasManaged.length > 0 || user.role === Role.SUPERADMIN,
        },
    };
    }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        avatar: { select: { id: true, name: true, path: true } },
        arenasManaged: {
          select: {
            id: true,
            name: true,
            courts: {
              select: {
                id: true,
                name: true,
                sport: true,
              },
            },
          },
        },
      },
    });

    // 1. Verifica se o usuário existe E se possui uma senha cadastrada (não é uma conta puramente OAuth)
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Agora o TypeScript sabe com certeza que user.password é uma string!
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isManager: user.arenasManaged.length > 0 || user.role === Role.SUPERADMIN,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.' };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'reset-password' },
      { expiresIn: '30m' },
    );

    // Envia o e-mail via Resend
    await this.mailService.sendPasswordResetEmail(user.email, user.name, resetToken);

    return {
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch (error) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    if (payload.type !== 'reset-password') {
      throw new BadRequestException('Token de tipo inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return { message: 'Senha redefinida com sucesso!' };
  }
}