import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanBillingCycle, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto';

function toAsaasCycle(cycle: PlanBillingCycle): 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY' {
  return cycle === 'ANNUALLY' ? 'YEARLY' : cycle;
}

@Injectable()
export class MembershipPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  private async assertIsArenaAdmin(arenaId: string, user: any) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: { admins: { select: { id: true } }, staff: { select: { id: true } } },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');
    const isAllowed =
      arena.admins.some((a) => a.id === user.id) ||
      arena.staff.some((s) => s.id === user.id) ||
      user.role === Role.SUPERADMIN;
    if (!isAllowed) throw new ForbiddenException('Apenas a equipe da arena pode gerenciar planos de mensalidade.');
    return arena;
  }

  // ---------------- CRUD (Dono/Staff da arena) ----------------

  async create(arenaId: string, user: any, dto: CreateMembershipPlanDto) {
    await this.assertIsArenaAdmin(arenaId, user);
    return this.prisma.arenaMembershipPlan.create({ data: { ...dto, arenaId } });
  }

  findAll(arenaId: string, includeInactive = false) {
    return this.prisma.arenaMembershipPlan.findMany({
      where: { arenaId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { price: 'asc' },
    });
  }

  private async findOneOrThrow(arenaId: string, planId: string) {
    const plan = await this.prisma.arenaMembershipPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.arenaId !== arenaId) throw new NotFoundException('Plano de mensalidade não encontrado.');
    return plan;
  }

  async update(arenaId: string, planId: string, user: any, dto: UpdateMembershipPlanDto) {
    await this.assertIsArenaAdmin(arenaId, user);
    await this.findOneOrThrow(arenaId, planId);
    return this.prisma.arenaMembershipPlan.update({ where: { id: planId }, data: dto });
  }

  async remove(arenaId: string, planId: string, user: any) {
    await this.assertIsArenaAdmin(arenaId, user);
    await this.findOneOrThrow(arenaId, planId);
    // Mesma lógica dos planos de plataforma: desativa em vez de apagar, pra
    // não perder o histórico de assinaturas já feitas nesse plano.
    return this.prisma.arenaMembershipPlan.update({ where: { id: planId }, data: { isActive: false } });
  }

  // ---------------- Assinatura do atleta (B2C) ----------------

  async subscribe(arenaId: string, planId: string, user: any, dto: SubscribeMembershipDto) {
    const arena = await this.prisma.arena.findUnique({ where: { id: arenaId } });
    if (!arena) throw new NotFoundException('Arena não encontrada.');
    if (!arena.asaasWalletId) {
      throw new BadRequestException('Esta arena ainda não está habilitada para receber pagamentos online.');
    }

    const plan = await this.findOneOrThrow(arenaId, planId);
    if (!plan.isActive) throw new BadRequestException('Este plano não está mais disponível.');

    const existingActive = await this.prisma.athleteMembership.findFirst({
      where: { userId: user.id, plan: { arenaId }, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (existingActive) {
      throw new BadRequestException('Você já possui uma mensalidade ativa ou pendente nesta arena.');
    }

    let asaasCustomerId = (await this.prisma.user.findUnique({ where: { id: user.id } }))?.asaasCustomerId;
    if (!asaasCustomerId) {
      const customer = await this.asaasService.createCustomer({
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpf || undefined,
        phone: user.phone || undefined,
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;
      await this.prisma.user.update({ where: { id: user.id }, data: { asaasCustomerId } });
    }

    const localMembership = await this.prisma.athleteMembership.create({
      data: {
        arenaMembershipPlanId: plan.id,
        userId: user.id,
        asaasSubscriptionId: `pending:${user.id}:${Date.now()}`,
        status: 'PENDING',
        currentCycleStart: new Date(),
        currentCycleEnd: new Date(),
      },
    });

    try {
      const nextDueDate = new Date().toISOString().slice(0, 10);
      const asaasSubscription = await this.asaasService.createSubscription({
        customer: asaasCustomerId!,
        billingType: dto.billingType,
        value: Number(plan.price),
        nextDueDate,
        cycle: toAsaasCycle(plan.billingCycle),
        description: `Mensalidade — ${plan.name}`,
        externalReference: `membership:${localMembership.id}`,
        // Sem taxa da Setto aqui: 100% direto pra subconta da arena.
        split: [{ walletId: arena.asaasWalletId, percentualValue: 100 }],
      });

      return this.prisma.athleteMembership.update({
        where: { id: localMembership.id },
        data: { asaasSubscriptionId: asaasSubscription.id },
      });
    } catch (error) {
      await this.prisma.athleteMembership.delete({ where: { id: localMembership.id } }).catch(() => {});
      throw error;
    }
  }

  async cancel(arenaId: string, membershipId: string, user: any) {
    const membership = await this.prisma.athleteMembership.findUnique({
      where: { id: membershipId },
      include: { plan: true },
    });
    if (!membership || membership.plan.arenaId !== arenaId) {
      throw new NotFoundException('Mensalidade não encontrada.');
    }

    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: { admins: { select: { id: true } }, staff: { select: { id: true } } },
    });
    const isOwner = membership.userId === user.id;
    const isArenaStaff =
      arena?.admins.some((a) => a.id === user.id) || arena?.staff.some((s) => s.id === user.id) || user.role === Role.SUPERADMIN;
    if (!isOwner && !isArenaStaff) {
      throw new ForbiddenException('Você não tem permissão para cancelar esta mensalidade.');
    }

    if (!membership.asaasSubscriptionId.startsWith('pending:')) {
      await this.asaasService.cancelSubscription(membership.asaasSubscriptionId);
    }

    return this.prisma.athleteMembership.update({
      where: { id: membership.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  myMemberships(arenaId: string, userId: string) {
    return this.prisma.athleteMembership.findMany({
      where: { userId, plan: { arenaId } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
