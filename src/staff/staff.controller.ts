import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StaffService } from './staff.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Pesquisar se um usuário já existe no sistema pelo e-mail' })
  searchUserByEmail(@Query('email') email: string) {
    return this.staffService.searchUserByEmail(email);
  }

  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Enviar convite de equipe para um e-mail' })
  createInvite(@Request() req, @Body() dto: CreateInviteDto) {
    return this.staffService.createInvite(req.user.id, dto);
  }

  @Get('my-invites')
  @ApiOperation({ summary: 'Listar convites de equipe pendentes do usuário logado' })
  getMyInvites(@Request() req) {
    return this.staffService.getMyInvites(req.user.email);
  }

  @Patch('invite/:id/respond')
  @ApiOperation({ summary: 'Aceitar ou recusar um convite de equipe' })
  respondInvite(
    @Param('id') inviteId: string,
    @Request() req,
    @Body('accept') accept: boolean,
  ) {
    return this.staffService.respondInvite(
      inviteId,
      req.user.id,
      req.user.email,
      accept,
    );
  }
}