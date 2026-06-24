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
import { I18nService } from './i18n.service';
import { I18nConfigRequestDto, CreateI18nEntryDto, UpdateI18nEntryDto, UpsertI18nKeyDto, I18nOpLogQueryDto, CreateI18nOpLogDto } from './dto/i18n.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('I18n')
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Post('config')
  @Public()
  @ApiOperation({ summary: 'Get all i18n translations (public, proxied from plugin API)' })
  getConfig(@Body() dto: I18nConfigRequestDto) {
    return this.i18nService.getConfig(dto.language);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'List i18n entries with pagination' })
  findAll(@Query() pagination: PaginationDto) {
    return this.i18nService.findAll(pagination.page, pagination.pageSize);
  }

  @Get('op-logs')
  @ApiBearerAuth()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'List i18n operation logs' })
  getOpLogs(@Query() query: I18nOpLogQueryDto) {
    return this.i18nService.getOpLogs(query.page, query.pageSize, query.action, query.key);
  }

  @Get('key/:key')
  @ApiBearerAuth()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'Get all translations for a key' })
  @ApiParam({ name: 'key', type: String })
  findByKey(@Param('key') key: string) {
    return this.i18nService.findByKey(key);
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'Get i18n entry by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.i18nService.findOne(id);
  }

  @Post('key')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Create or update a key with all language translations' })
  upsertKey(@Body() dto: UpsertI18nKeyDto) {
    return this.i18nService.upsertKey(dto);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Create single i18n entry' })
  create(@Body() dto: CreateI18nEntryDto) {
    return this.i18nService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Update i18n entry by ID' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateI18nEntryDto) {
    return this.i18nService.update(id, dto);
  }

  @Delete('key/:key')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Delete all translations for a key' })
  @ApiParam({ name: 'key', type: String })
  removeByKey(@Param('key') key: string) {
    return this.i18nService.removeByKey(key);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Delete i18n entry by ID' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.i18nService.remove(id);
  }

  @Post('op-logs')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Create i18n operation log' })
  createOpLog(@Body() dto: CreateI18nOpLogDto) {
    return this.i18nService.writeOpLog(dto.action, dto.operator ?? null, dto.key ?? null, dto.detail);
  }
}
