import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // ajuste o caminho conforme sua estrutura
import { CreatePlatformPlanDto } from './dto/create-platform-plan.dto';
import { UpdatePlatformPlanDto } from './dto/update-platform-plan.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class PlatformPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlatformPlanDto) {
    return this.prisma.platformPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        billingCycle: dto.billingCycle,
        maxCourts: dto.maxCourts ?? null,
        maxStaff: dto.maxStaff ?? null,
      },
    });
  }

  async findAll() {
    return this.prisma.platformPlan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.platformPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    return plan;
  }

  async update(id: string, dto: UpdatePlatformPlanDto) {
    await this.findOne(id); // Garante que existe antes de atualizar

    return this.prisma.platformPlan.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActive(id: string) {
    const plan = await this.findOne(id);

    return this.prisma.platformPlan.update({
      where: { id },
      data: { isActive: !plan.isActive },
    });
  }

  async getLandingPageData() {
    const [plans, activeArenas, activeCourts, totalBookings] = await this.prisma.$transaction([
      // 1. Planos ativos para contratacao
      this.prisma.platformPlan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          billingCycle: true,
          maxCourts: true,
          maxStaff: true,
        },
      }),

      // 2. Total de Arenas ativas
      this.prisma.arena.count({
        where: { isActive: true },
      }),

      // 3. Total de Quadras ativas
      this.prisma.court.count({
        where: { 
          isActive: true,
          arena: { isActive: true }, // garante que a arena pai também está ativa
        },
      }),

      // 4. Total de Agendamentos (desconsiderando os cancelados)
      this.prisma.booking.count({
        where: {
          status: {
            not: BookingStatus.CANCELLED,
          },
        },
      }),
    ]);

    return {
      plans,
      stats: {
        activeArenas,
        activeCourts,
        totalBookings,
      },
    };
  }
}