import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsService, DEFAULT_QUEUE } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { JobStatus } from '@prisma/client';

const mockQueue = {
  add: jest.fn(),
};

const mockPrisma = {
  job: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(DEFAULT_QUEUE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get<JobsService>(JobsService);
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('creates a DB job record and enqueues it', async () => {
      const dbJob = {
        id: 'job1',
        queue: DEFAULT_QUEUE,
        name: 'send-email',
        status: JobStatus.PENDING,
        attempts: 0,
      };
      mockPrisma.job.create.mockResolvedValue(dbJob);
      mockQueue.add.mockResolvedValue({ id: 'job1' });

      const result = await service.enqueue({ name: 'send-email', payload: { to: 'x@x.com' } });
      expect(result).toHaveProperty('status', JobStatus.PENDING);
      expect(mockPrisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'send-email', status: JobStatus.PENDING }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated jobs', async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);
      const result = await service.findAll({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalPages', 0);
    });

    it('filters by queue and status', async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);
      await service.findAll({
        queue: DEFAULT_QUEUE,
        status: JobStatus.COMPLETED,
        page: 1,
        pageSize: 10,
      });
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { queue: DEFAULT_QUEUE, status: JobStatus.COMPLETED },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a job by id', async () => {
      const dbJob = { id: 'job1', name: 'test', status: JobStatus.COMPLETED };
      mockPrisma.job.findUnique.mockResolvedValue(dbJob);
      const result = await service.findOne('job1');
      expect(result.id).toBe('job1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
