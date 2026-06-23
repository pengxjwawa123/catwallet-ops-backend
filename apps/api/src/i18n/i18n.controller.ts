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
import { I18nConfigRequestDto, CreateI18nEntryDto, UpdateI18nEntryDto } from './dto/i18n.dto';
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
  @ApiOperation({ summary: 'List i18n entries (reserved)' })
  findAll(@Query() _pagination: PaginationDto) {
    return this.i18nService.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'Get i18n entry by ID (reserved)' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.i18nService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Create i18n entry (reserved)' })
  create(@Body() dto: CreateI18nEntryDto) {
    return this.i18nService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Update i18n entry (reserved)' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateI18nEntryDto) {
    return this.i18nService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Delete i18n entry (reserved)' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.i18nService.remove(id);
  }
}
