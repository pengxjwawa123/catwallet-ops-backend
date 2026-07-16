import { IsOptional, IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddI18nDto {
  @ApiProperty({ example: 'common.cancel', description: 'Translation key' })
  @IsString()
  @IsNotEmpty()
  configKey: string;

  @ApiProperty({ example: '取消', description: 'Chinese translation' })
  @IsString()
  @IsNotEmpty()
  zh: string;

  @ApiProperty({ example: 'Cancel', description: 'English translation' })
  @IsString()
  @IsNotEmpty()
  en: string;
}

export class UpdateI18nDto {
  @ApiProperty({ example: 'common.cancel', description: 'Translation key' })
  @IsString()
  @IsNotEmpty()
  configKey: string;

  @ApiProperty({ example: '5048', description: 'Entry id to update' })
  @IsString()
  @IsNotEmpty()
  id: string;

  // zh / en are optional: pass only the language(s) being changed. An omitted
  // or empty value leaves that language untouched upstream.
  @ApiPropertyOptional({ example: '取消', description: 'Chinese translation' })
  @IsOptional()
  @IsString()
  zh?: string;

  @ApiPropertyOptional({ example: 'Cancel', description: 'English translation' })
  @IsOptional()
  @IsString()
  en?: string;
}

export class SearchI18nDto {
  @ApiProperty({
    example: 'Vote and Earn Rewards',
    description: 'Keyword to search by key or value',
  })
  @IsString()
  @IsNotEmpty()
  keyword: string;
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

  // `operator` is intentionally NOT accepted from the client — it is derived
  // from the authenticated principal server-side to prevent audit spoofing.

  @ApiPropertyOptional({ example: 'common.cancel' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  detail?: unknown;
}
