import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService, DEFAULT_QUEUE } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';

@Module({
  imports: [BullModule.registerQueue({ name: DEFAULT_QUEUE })],
  providers: [JobsService, JobsProcessor],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
