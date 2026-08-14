import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'beach_social_club_secret_key_2026_dev',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            activeArenaId: true,
            arenasManaged: {
            select: {
                id: true,
                name: true,
            },
            },
        },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}