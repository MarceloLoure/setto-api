import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
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
        arenas: user.arenasManaged,
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
            avatarUrl: user.avatarUrl || avatarUrl,
          },
          include: {
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
          avatarUrl,
          ...providerField,
          role: 'ATHLETE',
        },
        include: {
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
        avatarUrl: user.avatarUrl,
        arenas: user.arenasManaged,
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
        arenasManaged: { select: { id: true, name: true } },
        },
    });

    if (!user) {
        user = await this.prisma.user.create({
        data: {
            email,
            name: name || 'Atleta',
            avatarUrl: picture || null,
            googleId: uid,
            role: 'ATHLETE',
        },
        include: {
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
        avatarUrl: user.avatarUrl,
        arenas: user.arenasManaged,
        },
    };
    }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
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
        avatarUrl: user.avatarUrl,
        arenas: user.arenasManaged,
      },
    };
  }
}