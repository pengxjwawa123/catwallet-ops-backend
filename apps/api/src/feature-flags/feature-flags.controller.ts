import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  ToggleFeatureFlagDto,
} from './dto/feature-flag.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @RequirePermission('feature_flag:manage')
  @ApiOperation({ summary: 'Create feature flag' })
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @Get()
  @RequirePermission('feature_flag:read')
  @ApiOperation({ summary: 'List feature flags with pagination' })
  findAll(@Query() pagination: PaginationDto) {
    return this.featureFlagsService.findAll(pagination);
  }

  @Get('by-key/:key')
  @RequirePermission('feature_flag:read')
  @ApiOperation({ summary: 'Get feature flag by key (cached)' })
  @ApiParam({ name: 'key', type: String })
  findByKey(@Param('key') key: string) {
    return this.featureFlagsService.findByKey(key);
  }

  @Get(':id')
  @RequirePermission('feature_flag:read')
  @ApiOperation({ summary: 'Get feature flag by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.featureFlagsService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('feature_flag:manage')
  @ApiOperation({ summary: 'Update feature flag' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.featureFlagsService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequirePermission('feature_flag:manage')
  @ApiOperation({ summary: 'Toggle feature flag status' })
  @ApiParam({ name: 'id', type: String })
  toggle(@Param('id') id: string, @Body() dto: ToggleFeatureFlagDto) {
    return this.featureFlagsService.toggle(id, dto);
  }

  @Delete(':id')
  @RequirePermission('feature_flag:manage')
  @ApiOperation({ summary: 'Delete feature flag' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.featureFlagsService.remove(id);
  }
}
