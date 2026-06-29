import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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
  @RequirePermission('job:manage')
  @ApiOperation({ summary: 'Enqueue a job' })
  enqueue(@Body() dto: EnqueueJobDto, @CurrentUser() _user: RequestUser) {
    return this.jobsService.enqueue(dto);
  }

  @Get()
  @RequirePermission('job:read')
  @ApiOperation({
    summary: 'List jobs with pagination and optional filters',
  })
  findAll(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('job:read')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
