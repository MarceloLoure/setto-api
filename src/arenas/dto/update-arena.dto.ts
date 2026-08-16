import { PartialType } from '@nestjs/swagger';
import { CreateArenaRequestDto } from './create-arena-request.dto';

export class UpdateArenaDto extends PartialType(CreateArenaRequestDto) {}