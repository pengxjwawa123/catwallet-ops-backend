import { IsOptional, IsString, IsNotEmpty, IsObject, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class I18nConfigRequestDto {
  @ApiPropertyOptional({ example: 'zh', description: 'Filter by language code' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateI18nEntryDto {
  @ApiProperty({ example: 'cancel' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({ example: 'Cancel' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class UpdateI18nEntryDto {
  @ApiPropertyOptional({ example: 'Cancel' })
  @IsOptional()
  @IsString()
  value?: string;
}

export class UpsertI18nKeyDto {
  @ApiProperty({ example: 'cancel', description: 'Translation key' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    example: { en: 'Cancel', zh: '取消' },
    description: 'Language → value map',
  })
  @IsObject()
  translations: Record<string, string>;
}

export class I18nOpLogQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  key?: string;
}

export class CreateI18nOpLogDto {
  @ApiProperty({ example: 'create' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional({ example: 'common.cancel' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  detail?: unknown;
}
