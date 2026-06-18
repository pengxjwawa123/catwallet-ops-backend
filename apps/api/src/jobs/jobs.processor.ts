import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '@prisma/client';
import { DEFAULT_QUEUE } from './jobs.service';

@Processor(DEFAULT_QUEUE)
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: BullJob): Promise<unknown> {
    const dbJobId: string | undefined = job.data?._jobId;
    this.logger.log(`Processing job: ${job.name} (${dbJobId ?? job.id})`);

    if (dbJobId) {
      await this.prisma.job.update({
        where: { id: dbJobId },
        data: {
          status: JobStatus.RUNNING,
          startedAt: new Date(),
          attempts: (job.attemptsMade ?? 0) + 1,
        },
      });
    }

    // --- Demo logic: simulate work ---
    const payload = job.data ?? {};
    if (payload['fail'] === true) {
      throw new Error('Simulated job failure');
    }
    const result = { processed: true, name: job.name, at: new Date().toISOString() };
    // ---------------------------------

    if (dbJobId) {
      await this.prisma.job.update({
        where: { id: dbJobId },
        data: {
          status: JobStatus.COMPLETED,
          result,
          finishedAt: new Date(),
        },
      });
    }

    return result;
  }

  // Called when BullMQ exhausts all retries
  async onFailed(job: BullJob, error: Error): Promise<void> {
    const dbJobId: string | undefined = job.data?._jobId;
    this.logger.warn(`Job failed: ${job.name} (${dbJobId ?? job.id}) — ${error.message}`);

    if (dbJobId) {
      await this.prisma.job.update({
        where: { id: dbJobId },
        data: {
          status: JobStatus.FAILED,
          error: error.message,
          finishedAt: new Date(),
        },
      });
    }
  }
}
