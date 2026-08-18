import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteStatus, Role } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  // 1. Pesquisa usuários cadastrados no sistema pelo e-mail
  async searchUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      return { found: false, user: null };
    }

    return { found: true, user };
  }

  // 2. Enviar convite para a equipe
  async createInvite(invitedByUserId: string, dto: CreateInviteDto) {
    // Valida se o cargo é válido para funcionário
    if (dto.role !== Role.RECEPTIONIST && dto.role !== Role.TEACHER) {
      throw new BadRequestException('O convite deve ser para RECEPTIONIST ou TEACHER');
    }

    // Verifica se a arena existe e se quem convida é o gestor
    const arena = await this.prisma.arena.findUnique({
      where: { id: dto.arenaId },
      include: { admins: { select: { id: true } } },
    });

    if (!arena) {
      throw new NotFoundException('Arena não encontrada');
    }

    const isAdmin = arena.admins.some((admin) => admin.id === invitedByUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Apenas administradores da arena podem convidar funcionários');
    }

    // Verifica se já existe um convite pendente para este e-mail na mesma arena
    const existingInvite = await this.prisma.staffInvite.findFirst({
      where: {
        email: dto.email,
        arenaId: dto.arenaId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new BadRequestException('Já existe um convite pendente para este e-mail nesta arena.');
    }

    // Cria o convite no banco
    return this.prisma.staffInvite.create({
      data: {
        email: dto.email,
        role: dto.role,
        arenaId: dto.arenaId,
        invitedById: invitedByUserId,
      },
      include: {
        arena: { select: { id: true, name: true } },
      },
    });
  }

  // 3. Buscar convites pendentes do usuário logado (pelo e-mail)
  async getMyInvites(userEmail: string) {
    return this.prisma.staffInvite.findMany({
      where: {
        email: userEmail,
        status: InviteStatus.PENDING,
      },
      include: {
        arena: { select: { id: true, name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });
  }

  // 4. Aceitar ou Recusar um Convite
  async respondInvite(inviteId: string, userId: string, userEmail: string, accept: boolean) {
    const invite = await this.prisma.staffInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException('Convite não encontrado ou já respondido.');
    }

    if (invite.email !== userEmail) {
      throw new ForbiddenException('Este convite não pertence a você.');
    }

    if (!accept) {
      // Recusa o convite
      return this.prisma.staffInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.REJECTED },
      });
    }

    // Se Aceito:
    // 1. Busca o usuário atual
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!currentUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Valida se o usuário é ATHLETE para atualizar a role, caso contrário mantém a atual
    const newRole =
      currentUser.role === Role.ATHLETE ? invite.role : currentUser.role;

    await this.prisma.$transaction([
      // Atualiza o status do convite
      this.prisma.staffInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.ACCEPTED },
      }),
      // Vincula o usuário à arena como funcionário
      this.prisma.user.update({
        where: { id: userId },
        data: {
          role: newRole,
          arenasEmployed: {
            connect: { id: invite.arenaId },
          },
        },
      }),
    ]);

    return { message: 'Convite aceito com sucesso! Agora você faz parte da equipe.' };
  }
}