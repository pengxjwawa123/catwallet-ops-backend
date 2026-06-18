import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class EnqueueJobDto {
  @ApiProperty({ example: 'send-email' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON payload' })
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class JobQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'default' })
  @IsOptional()
  @IsString()
  queue?: string;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
