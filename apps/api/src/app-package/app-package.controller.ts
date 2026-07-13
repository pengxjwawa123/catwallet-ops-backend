import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AppPackageService, UploadedFileLike } from './app-package.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('App')
@ApiBearerAuth()
@Controller('app')
export class AppPackageController {
  constructor(private readonly appPackageService: AppPackageService) {}

  @Post('upload')
  @RequirePermission('app:upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload an app package (e.g. .apk) to CatWallet' })
  upload(@UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('file is required');
    return this.appPackageService.upload(file);
  }
}
