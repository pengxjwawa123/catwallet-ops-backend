import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlagStatus } from '@prisma/client';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'new-dashboard' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({ example: 'Enable new dashboard UI' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FlagStatus, default: FlagStatus.DISABLED })
  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @ApiPropertyOptional({ description: 'Arbitrary JSON payload' })
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({ example: 'Enable new dashboard UI' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FlagStatus })
  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class ToggleFeatureFlagDto {
  @ApiProperty({ enum: FlagStatus })
  @IsEnum(FlagStatus)
  status: FlagStatus;
}
