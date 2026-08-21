import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HomeSectionType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateHomeSectionDto {
  @ApiProperty({ enum: HomeSectionType, example: HomeSectionType.HERO_BANNERS })
  @IsEnum(HomeSectionType)
  @IsNotEmpty()
  type: HomeSectionType;

  @ApiPropertyOptional({ example: 'Seus Próximos Jogos' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Não perca seus horários agendados' })
  @IsString()
  @IsOptional()
  subtitle?: string;

  @ApiProperty({ example: 1, description: 'Ordem de exibição (1 = topo)' })
  @IsInt()
  @Min(1)
  order: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReorderHomeSectionsDto {
  @ApiProperty({
    example: [
      { id: 'uuid-1', order: 1 },
      { id: 'uuid-2', order: 2 },
    ],
  })
  sections: { id: string; order: number }[];
}