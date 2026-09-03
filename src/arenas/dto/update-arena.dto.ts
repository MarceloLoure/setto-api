import { PartialType } from '@nestjs/swagger';
import { CreateSubAccountDto } from './create-arena-request.dto';

export class UpdateArenaDto extends PartialType(CreateSubAccountDto) {}