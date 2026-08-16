import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Request
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { MAX_FILE_SIZE, multerImageFilter } from 'src/common/utils/multer-image.filter';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter perfil do usuário logado' })
  getProfile(@CurrentUser('id') userId: string,) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'avatar', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ],
    {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: multerImageFilter,
    },
  ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enriquecer/Atualizar perfil, foto de avatar e foto de capa',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Foto de perfil (JPG, PNG ou WEBP)',
        },
        cover: {
          type: 'string',
          format: 'binary',
          description: 'Foto de capa (JPG, PNG ou WEBP)',
        },
        name: { type: 'string', example: 'Marcelo Silva' },
        phone: { type: 'string', example: '+5543999999999' },
        cpf: { type: 'string', example: '12345678901' },
        gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'], example: 'MALE' },
        birthDate: { type: 'string', example: '1995-08-20' },
        city: { type: 'string', example: 'Londrina' },
        state: { type: 'string', example: 'PR' },
        bio: { type: 'string', example: 'Atleta amador de Beach Tennis' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso.' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado em outra conta.' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFiles()
    files?: {
      avatar?: Express.Multer.File[];
      cover?: Express.Multer.File[];
    },
  ) {
    return this.usersService.updateProfile(userId, dto, files);
  }
}