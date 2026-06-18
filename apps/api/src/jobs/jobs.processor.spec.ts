import { Test, TestingModule } from '@nestjs/testing';
import { JobsProcessor } from './jobs.processor';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '@prisma/client';
import { Job as BullJob } from 'bullmq';

const mockPrisma = {
  job: {
    update: jest.fn(),
  },
};

function makeBullJob(overrides: Partial<BullJob> = {}): BullJob {
  return {
    id: 'bull-1',
    name: 'demo-task',
    data: { _jobId: 'db-job-1' },
    attemptsMade: 0,
    ...overrides,
  } as unknown as BullJob;
}

describe('JobsProcessor', () => {
  let processor: JobsProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    processor = module.get<JobsProcessor>(JobsProcessor);
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('sets status RUNNING then COMPLETED on success', async () => {
      mockPrisma.job.update.mockResolvedValue({});
      const job = makeBullJob();
      const result = await processor.process(job);

      expect(result).toHaveProperty('processed', true);
      expect(mockPrisma.job.update).toHaveBeenCalledTimes(2);
      // First call: RUNNING
      expect(mockPrisma.job.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.RUNNING }) }),
      );
      // Second call: COMPLETED
      expect(mockPrisma.job.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.COMPLETED }) }),
      );
    });

    it('throws when payload.fail is true', async () => {
      mockPrisma.job.update.mockResolvedValue({});
      const job = makeBullJob({ data: { _jobId: 'db-job-1', fail: true } });
      await expect(processor.process(job)).rejects.toThrow('Simulated job failure');
    });
  });

  describe('onFailed', () => {
    it('sets status FAILED with error message', async () => {
      mockPrisma.job.update.mockResolvedValue({});
      const job = makeBullJob();
      await processor.onFailed(job, new Error('timeout'));
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: JobStatus.FAILED,
            error: 'timeout',
          }),
        }),
      );
    });
  });
});
