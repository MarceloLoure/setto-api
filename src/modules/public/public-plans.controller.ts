import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlatformPlansService } from '../../super-admin/platform-plans.service';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { PublicCheckoutService } from './public-checkout.service';

@ApiTags('Público - Landing Page & Onboarding')
@Controller('public')
export class PublicPlansController {
  constructor(
    private readonly platformPlansService: PlatformPlansService,
    private readonly publicCheckoutService: PublicCheckoutService,
  ) {}

  @Get('landing-page')
  @ApiOperation({ 
    summary: 'Buscar dados da landing page', 
    description: 'Retorna os planos ativos e métricas de prova social (total de arenas, quadras e agendamentos).' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dados da landing page carregados com sucesso.',
    schema: {
      example: {
        plans: [
          {
            id: 'c0a80101-0000-0000-0000-000000000001',
            name: 'Pro',
            description: 'Plano completo para grandes arenas',
            price: 199.90,
            billingCycle: 'MONTHLY',
            maxCourts: 5,
            maxStaff: 3
          }
        ],
        stats: {
          activeArenas: 15,
          activeCourts: 62,
          totalBookings: 18450
        }
      }
    }
  })
  async getLandingPageData() {
    return this.platformPlansService.getLandingPageData();
  }

  @Post('checkout/arena')
  @ApiOperation({ summary: 'Iniciar contratação do plano pela Landing Page' })
  async checkoutArena(@Body() dto: PublicCheckoutDto) {
    return this.publicCheckoutService.processCheckout(dto);
  }

  @Get('invites/validate/:token')
  @ApiOperation({ summary: 'Validar token de convite no formulário de cadastro' })
  async validateInviteToken(@Param('token') token: string) {
    return this.publicCheckoutService.validateInviteToken(token);
  }
}