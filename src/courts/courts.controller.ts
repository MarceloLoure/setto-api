import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@ApiTags('Courts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new court for the arena' })
  @ApiResponse({ status: 201, description: 'Court created successfully' })
  create(@Request() req, @Body() dto: CreateCourtDto) {
    return this.courtsService.create(req.user, dto);
  }

  @Get('arena/:arenaId')
  @ApiOperation({ summary: 'List all courts belonging to a specific arena' })
  findByArena(@Param('arenaId') arenaId: string) {
    return this.courtsService.findByArena(arenaId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Update court details or status (e.g. toggle isActive)' })
  update(
    @Param('id') courtId: string,
    @Request() req,
    @Body() dto: UpdateCourtDto,
  ) {
    return this.courtsService.update(courtId, req.user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ARENA_ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Delete a court' })
  remove(@Param('id') courtId: string, @Request() req) {
    return this.courtsService.remove(courtId, req.user);
  }
}