import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
