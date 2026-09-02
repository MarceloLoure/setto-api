import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Aplica-se em rotas de gestão que tenham :arenaId na URL. Bloqueia o acesso
 * se a assinatura da plataforma Setto daquela arena estiver OVERDUE/CANCELLED.
 * SUPERADMIN nunca é bloqueado (precisa continuar acessando pra gerenciar
 * cobrança e liberar manualmente se preciso).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;

    if (!user || user.role === Role.SUPERADMIN) return true;

    // Rotas de gestão usam ora `:arenaId`, ora `:id` (quando o próprio
    // recurso da rota já é a arena, ex: PATCH /arenas/:id). Aceitamos os dois.
    const arenaId: string | undefined = params?.arenaId ?? params?.id;
    if (!arenaId) return true; // Guard só se aplica a rotas com arena no path.

    const subscription = await this.prisma.arenaSubscription.findFirst({
      where: { arenaId },
      orderBy: { createdAt: 'desc' },
    });

    // Sem nenhuma assinatura registrada ainda: deixa passar (arena em trial /
    // onboarding). Ajustar aqui se a regra de negócio exigir bloqueio total.
    if (!subscription) return true;

    if (subscription.status === SubscriptionStatus.OVERDUE || subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ForbiddenException(
        'O acesso ao painel de gestão está bloqueado por pendência financeira com a plataforma Setto. Regularize o pagamento para continuar.',
      );
    }

    return true;
  }
}
