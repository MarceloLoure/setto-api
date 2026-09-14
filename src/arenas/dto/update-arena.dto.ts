import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSubAccountDto } from './create-arena-request.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateArenaDto extends PartialType(CreateSubAccountDto) {

  @ApiPropertyOptional({ description: 'Alias para cpfCnpj' })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiPropertyOptional({ description: 'Alias para addressNumber' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ description: 'Alias para province' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ description: 'Alias para postalCode' })
  @IsOptional()
  @IsString()
  zipCode?: string;
}