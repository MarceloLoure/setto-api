import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SuperAdminService } from './super-admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Role } from '@prisma/client/edge';

@ApiTags('SuperAdmin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get total system metrics (Users, Arenas, Courts, Bookings)' })
  getOverview() {
    return this.superAdminService.getSystemOverview();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all registered users in the platform' })
  getAllUsers() {
    return this.superAdminService.getAllUsers();
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update role or arena binding of any user' })
  updateUserRole(@Param('id') userId: string, @Body() dto: UpdateUserRoleDto) {
    return this.superAdminService.updateUserRole(userId, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Force delete a user account' })
  deleteUser(@Param('id') userId: string) {
    return this.superAdminService.deleteUser(userId);
  }

  @Get('arenas')
  @ApiOperation({ summary: 'List all arenas with internal counters' })
  getAllArenas() {
    return this.superAdminService.getAllArenas();
  }

  @Get('courts')
  @ApiOperation({ summary: 'List all courts across all arenas' })
  getAllCourts() {
    return this.superAdminService.getAllCourts();
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings across the platform' })
  getAllBookings() {
    return this.superAdminService.getAllBookings();
  }
}