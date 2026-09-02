import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanBillingCycle, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { CreatePlatformPlanDto } from './dto/create-platform-plan.dto';
import { UpdatePlatformPlanDto } from './dto/update-platform-plan.dto';
import { SubscribeToPlatformPlanDto } from './dto/subscribe-platform-plan.dto';

// Asaas usa "YEARLY" pro ciclo anual; nosso enum usa "ANNUALLY". O resto bate.
function toAsaasCycle(cycle: PlanBillingCycle): 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY' {
  return cycle === 'ANNUALLY' ? 'YEARLY' : cycle;
}

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  // ---------------- CRUD (SUPERADMIN) ----------------

  create(dto: CreatePlatformPlanDto) {
    return this.prisma.platformPlan.create({ data: dto });
  }

  findAll(includeInactive = false) {
    return this.prisma.platformPlan.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.platformPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  async update(id: string, dto: UpdatePlatformPlanDto) {
    await this.findOne(id);
    return this.prisma.platformPlan.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Nunca apaga de fato — planos podem ter assinaturas históricas vinculadas.
    // "Remover" aqui é só desativar pra sumir das opções de contratação.
    return this.prisma.platformPlan.update({ where: { id }, data: { isActive: false } });
  }

  // ---------------- Assinatura da arena (B2B) ----------------

  /** Arena contrata um PlatformPlan. Cobrança recorrente direto na conta master da Setto (sem split). */
  async subscribeArena(arenaId: string, user: any, dto: SubscribeToPlatformPlanDto) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: { admins: { select: { id: true } } },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    const isAdmin = arena.admins.some((a) => a.id === user.id) || user.role === Role.SUPERADMIN;
    if (!isAdmin) throw new ForbiddenException('Apenas o dono da arena pode contratar um plano.');

    const plan = await this.findOne(dto.platformPlanId);
    if (!plan.isActive) throw new BadRequestException('Este plano não está mais disponível.');

    const existingActive = await this.prisma.arenaSubscription.findFirst({
      where: { arenaId, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (existingActive) {
      throw new BadRequestException('Esta arena já possui uma assinatura ativa ou pendente com a plataforma.');
    }

    const owner = await this.prisma.user.findUnique({ where: { id: user.id } });

    let asaasCustomerId = owner?.asaasCustomerId;
    if (!asaasCustomerId) {
      const customer = await this.asaasService.createCustomer({
        name: owner?.name || arena.name,
        email: owner?.email ?? '',
        cpfCnpj: owner?.cpf ?? '',
        phone: owner?.phone ?? '',
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;
      await this.prisma.user.update({ where: { id: user.id }, data: { asaasCustomerId } });
    }

    // Placeholder local ANTES de chamar a Asaas — mesma lógica de trava de
    // duplicidade usada no checkout de reservas (ver bookings.service.ts).
    const localSubscription = await this.prisma.arenaSubscription.create({
      data: {
        arenaId,
        platformPlanId: plan.id,
        asaasSubscriptionId: `pending:${arenaId}:${Date.now()}`, // placeholder único temporário
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
        description: `Assinatura Setto — plano ${plan.name}`,
        externalReference: `arena_sub:${localSubscription.id}`,
      });

      return this.prisma.arenaSubscription.update({
        where: { id: localSubscription.id },
        data: { asaasSubscriptionId: asaasSubscription.id },
      });
    } catch (error) {
      await this.prisma.arenaSubscription.delete({ where: { id: localSubscription.id } }).catch(() => {});
      throw error;
    }
  }

  async cancelArenaSubscription(arenaId: string, user: any) {
    const arena = await this.prisma.arena.findUnique({
      where: { id: arenaId },
      include: { admins: { select: { id: true } } },
    });
    if (!arena) throw new NotFoundException('Arena não encontrada.');

    const isAdmin = arena.admins.some((a) => a.id === user.id) || user.role === Role.SUPERADMIN;
    if (!isAdmin) throw new ForbiddenException('Apenas o dono da arena pode cancelar a assinatura.');

    const subscription = await this.prisma.arenaSubscription.findFirst({
      where: { arenaId, status: { in: ['ACTIVE', 'PENDING', 'OVERDUE'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('Nenhuma assinatura ativa encontrada para esta arena.');

    if (!subscription.asaasSubscriptionId.startsWith('pending:')) {
      await this.asaasService.cancelSubscription(subscription.asaasSubscriptionId);
    }

    return this.prisma.arenaSubscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async getArenaSubscription(arenaId: string) {
    return this.prisma.arenaSubscription.findFirst({
      where: { arenaId },
      include: { platformPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
