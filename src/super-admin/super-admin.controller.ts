import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdminPaginationQueryDto,
  FindUsersAdminQueryDto,
} from './dto/admin-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SuperAdminService } from './super-admin.service';

@ApiTags('Super Admin (Painel Web)')
@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@ApiBearerAuth()
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Métricas gerais e faturamento total da plataforma' })
  @ApiResponse({ status: 200, description: 'Métricas retornadas com sucesso.' })
  getOverview() {
    return this.superAdminService.getSystemOverview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar todos os usuários com busca, filtros por role e paginação' })
  getAllUsers(@Query() query: FindUsersAdminQueryDto) {
    return this.superAdminService.getAllUsers(query);
  }

  @Get('arenas')
  @ApiOperation({ summary: 'Listar todas as arenas com contadores operacionais e administradores' })
  getAllArenas(@Query() query: AdminPaginationQueryDto) {
    return this.superAdminService.getAllArenas(query);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Auditoria global de agendamentos e transações' })
  getAllBookings(@Query() query: AdminPaginationQueryDto) {
    return this.superAdminService.getAllBookings(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Alterar cargo de usuário e vincular a uma arena' })
  updateUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.superAdminService.updateUserRole(userId, dto);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Excluir usuário do sistema' })
  deleteUser(
    @Param('id') userId: string,
    @CurrentUser('id') superAdminId: string,
  ) {
    return this.superAdminService.deleteUser(userId, superAdminId);
  }
}