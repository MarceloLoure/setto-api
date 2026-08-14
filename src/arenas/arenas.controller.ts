import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArenasService } from './arenas.service';
import { CreateArenaRequestDto } from './dto/create-arena-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Crie ou importe seu Guard de JWT

@ApiTags('Arenas')
@Controller('arenas')
export class ArenasController {
  constructor(private readonly arenasService: ArenasService) {}

  @Post('become-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade an ATHLETE account to ARENA_ADMIN by registering a new Arena' })
  @ApiResponse({ status: 201, description: 'Arena registered and user promoted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Tax ID (CNPJ) already in use' })
  becomeArenaAdmin(@Request() req, @Body() dto: CreateArenaRequestDto) {
    const userId = req.user.id; // Extraído do Token JWT
    return this.arenasService.becomeArenaAdmin(userId, dto);
  }
}