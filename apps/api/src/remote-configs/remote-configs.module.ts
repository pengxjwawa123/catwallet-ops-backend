import { Module } from '@nestjs/common';
import { RemoteConfigsService } from './remote-configs.service';
import { RemoteConfigsController } from './remote-configs.controller';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [RemoteConfigsService],
  controllers: [RemoteConfigsController],
  exports: [RemoteConfigsService],
})
export class RemoteConfigsModule {}
