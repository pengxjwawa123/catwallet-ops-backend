import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { EnqueueJobDto, JobQueryDto } from './dto/job.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @RequirePermission('superadmin')
  @ApiOperation({ summary: 'Enqueue a job (superadmin only)' })
  enqueue(@Body() dto: EnqueueJobDto, @CurrentUser() _user: RequestUser) {
    return this.jobsService.enqueue(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs with pagination and optional filters (any authenticated user)' })
  findAll(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID (any authenticated user)' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
