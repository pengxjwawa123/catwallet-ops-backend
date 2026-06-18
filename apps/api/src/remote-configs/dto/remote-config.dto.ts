import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRemoteConfigDto {
  @ApiProperty({ example: 'max-upload-size' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: '10MB' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ example: 'Maximum upload size allowed' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRemoteConfigDto {
  @ApiPropertyOptional({ example: '20MB' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
