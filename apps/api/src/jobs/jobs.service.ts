import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/paginated-result';
import { EnqueueJobDto, JobQueryDto } from './dto/job.dto';
import { JobStatus, Prisma } from '@prisma/client';

export const DEFAULT_QUEUE = 'default';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(DEFAULT_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(dto: EnqueueJobDto) {
    // Create DB record first
    const job = await this.prisma.job.create({
      data: {
        queue: DEFAULT_QUEUE,
        name: dto.name,
        payload: dto.payload !== undefined ? (dto.payload as Prisma.InputJsonValue) : undefined,
        status: JobStatus.PENDING,
      },
    });

    // Enqueue in BullMQ with the DB job id as the jobId for traceability
    await this.queue.add(
      dto.name,
      { ...dto.payload, _jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(`Job enqueued: ${dto.name} (${job.id})`);
    return job;
  }

  async findAll(query: JobQueryDto) {
    const { page = 1, pageSize = 20, queue, status } = query;
    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = {};
    if (queue) where.queue = queue;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
