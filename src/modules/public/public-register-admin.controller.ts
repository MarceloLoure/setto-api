import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArenaInvitesService } from '../invite/arena-invites.service';


@ApiTags('Público - Pré-Registro Arena')
@Controller('public/invites')
export class PublicInvitesController {
  constructor(private readonly arenaInvitesService: ArenaInvitesService) {}

  @Get('validate/:token')
  @ApiOperation({ summary: 'Validar token de convite no formulário de cadastro' })
  @ApiResponse({ status: 200, description: 'Token válido.' })
  @ApiResponse({ status: 400, description: 'Token expirado ou já utilizado.' })
  @ApiResponse({ status: 404, description: 'Token inexistente.' })
  async validateToken(@Param('token') token: string) {
    return this.arenaInvitesService.validateToken(token);
  }
}