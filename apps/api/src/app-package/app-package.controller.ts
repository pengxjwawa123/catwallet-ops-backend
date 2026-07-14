import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppPackageService } from './app-package.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('App')
@ApiBearerAuth()
@Controller('app')
export class AppPackageController {
  constructor(private readonly appPackageService: AppPackageService) {}

  @Get('upload-url')
  @RequirePermission('app:upload')
  @ApiOperation({ summary: 'Get a presigned S3 URL for uploading an app package' })
  getUploadUrl() {
    return this.appPackageService.getUploadUrl();
  }

  @Get('refresh-cache')
  @RequirePermission('app:upload')
  @ApiOperation({ summary: 'Refresh the CatWallet cache after an app package upload' })
  refreshCache() {
    return this.appPackageService.refreshCache();
  }
}
