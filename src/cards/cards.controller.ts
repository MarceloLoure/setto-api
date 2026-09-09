import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @ApiOperation({ summary: 'Tokeniza e salva um novo cartão de crédito' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateCardDto) {
    return this.cardsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os cartões salvos do usuário autenticado' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.cardsService.findAllByUser(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um cartão salvo do usuário' })
  async remove(@CurrentUser('id') userId: string, @Param('id') cardId: string) {
    return this.cardsService.remove(userId, cardId);
  }
}