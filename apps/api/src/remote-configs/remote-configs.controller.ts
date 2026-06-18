import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RemoteConfigsService } from './remote-configs.service';
import { CreateRemoteConfigDto, UpdateRemoteConfigDto } from './dto/remote-config.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Remote Configs')
@ApiBearerAuth()
@Controller('remote-configs')
export class RemoteConfigsController {
  constructor(private readonly remoteConfigsService: RemoteConfigsService) {}

  @Post()
  @RequirePermission('remote_config:manage')
  @ApiOperation({ summary: 'Create remote config' })
  create(@Body() dto: CreateRemoteConfigDto) {
    return this.remoteConfigsService.create(dto);
  }

  @Get()
  @RequirePermission('remote_config:read')
  @ApiOperation({ summary: 'List remote configs with pagination' })
  findAll(@Query() pagination: PaginationDto) {
    return this.remoteConfigsService.findAll(pagination);
  }

  @Get('by-key/:key')
  @RequirePermission('remote_config:read')
  @ApiOperation({ summary: 'Get remote config by key (cached)' })
  @ApiParam({ name: 'key', type: String })
  findByKey(@Param('key') key: string) {
    return this.remoteConfigsService.findByKey(key);
  }

  @Get(':id')
  @RequirePermission('remote_config:read')
  @ApiOperation({ summary: 'Get remote config by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.remoteConfigsService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('remote_config:manage')
  @ApiOperation({ summary: 'Update remote config' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateRemoteConfigDto) {
    return this.remoteConfigsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('remote_config:manage')
  @ApiOperation({ summary: 'Delete remote config' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.remoteConfigsService.remove(id);
  }
}
