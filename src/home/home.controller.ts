import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HomeService } from './home.service';

@ApiTags('Home Feed (App Atleta)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({ summary: 'Obter tela inicial componentizada com dados personalizados do usuário' })
  @ApiQuery({ name: 'userCity', required: false, description: 'Cidade atual informada pelo app (GPS/Seleção)' })
  getHomeFeed(@CurrentUser('id') userId: string, @Query('userCity') userCity?: string,) {
    return this.homeService.getHomeFeed(userId, userCity ? { userCity: userCity } : undefined);
  }
}