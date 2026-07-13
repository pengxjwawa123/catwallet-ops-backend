import { Module } from '@nestjs/common';
import { AppPackageService } from './app-package.service';
import { AppPackageController } from './app-package.controller';

@Module({
  providers: [AppPackageService],
  controllers: [AppPackageController],
})
export class AppPackageModule {}
