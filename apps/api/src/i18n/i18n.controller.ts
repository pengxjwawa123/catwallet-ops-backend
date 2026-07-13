import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { I18nService } from './i18n.service';
import {
  AddI18nDto,
  UpdateI18nDto,
  SearchI18nDto,
  I18nOpLogQueryDto,
  CreateI18nOpLogDto,
} from './dto/i18n.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

/** Minimal shape of a multer-parsed upload (avoids depending on @types/multer). */
interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@ApiTags('I18n')
@ApiBearerAuth()
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get()
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'List all i18n translations (proxied from CatWallet)' })
  list() {
    return this.i18nService.list();
  }

  @Post('search')
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'Search i18n translations by keyword' })
  search(@Body() dto: SearchI18nDto) {
    return this.i18nService.search(dto.keyword);
  }

  @Post()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Add a new translation key with zh / en values' })
  add(@Body() dto: AddI18nDto) {
    return this.i18nService.add(dto.configKey, dto.zh, dto.en);
  }

  @Put()
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Update a translation entry value' })
  update(@Body() dto: UpdateI18nDto) {
    return this.i18nService.update(dto.configKey, dto.id, dto.value);
  }

  @Post('batch')
  @RequirePermission('i18n:manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Batch import translations from an uploaded spreadsheet' })
  batchImport(@UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('file is required');
    return this.i18nService.batchImport(file);
  }

  @Post('uploadApp')
  @RequirePermission('i18n:upload_app')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload an app package (e.g. .apk) to CatWallet' })
  uploadApp(@UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('file is required');
    return this.i18nService.uploadApp(file);
  }

  @Get('op-logs')
  @RequirePermission('i18n:read')
  @ApiOperation({ summary: 'List i18n operation logs' })
  getOpLogs(@Query() query: I18nOpLogQueryDto) {
    return this.i18nService.getOpLogs(query.page, query.pageSize, query.action, query.key);
  }

  @Post('op-logs')
  @RequirePermission('i18n:manage')
  @ApiOperation({ summary: 'Create i18n operation log' })
  createOpLog(@Body() dto: CreateI18nOpLogDto, @CurrentUser() caller: RequestUser) {
    // Operator is derived from the authenticated principal, never the request
    // body, so the audit actor cannot be spoofed.
    return this.i18nService.writeOpLog(dto.action, caller.username, dto.key ?? null, dto.detail);
  }
}
