import { Module } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { I18nController } from './i18n.controller';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [I18nService],
  controllers: [I18nController],
  exports: [I18nService],
})
export class I18nModule {}
