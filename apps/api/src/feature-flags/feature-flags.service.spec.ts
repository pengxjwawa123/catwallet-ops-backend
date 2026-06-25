import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlagStatus } from '@prisma/client';

const mockPrisma = {
  featureFlag: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockResolvedValue({
        id: 'f1',
        key: 'test',
        status: FlagStatus.DISABLED,
      });
      const result = await service.create({ key: 'test' });
      expect(result).toHaveProperty('key', 'test');
    });

    it('throws ConflictException when key already exists', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ id: 'f1' });
      await expect(service.create({ key: 'dup' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);
      mockPrisma.featureFlag.count.mockResolvedValue(0);
      const result = await service.findAll({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalPages', 0);
    });
  });

  describe('findByKey', () => {
    it('returns cached value when present', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.ENABLED };
      mockRedis.get.mockResolvedValue(JSON.stringify(flag));
      const result = await service.findByKey('k1');
      expect(result.key).toBe('k1');
      expect(mockPrisma.featureFlag.findUnique).not.toHaveBeenCalled();
    });

    it('fetches from DB and caches when cache miss', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.ENABLED };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
      const result = await service.findByKey('k1');
      expect(result.key).toBe('k1');
      expect(mockRedis.set).toHaveBeenCalledWith('feature_flag:k1', JSON.stringify(flag), 60);
    });

    it('throws NotFoundException when not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(service.findByKey('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates flag and invalidates cache', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.DISABLED };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
      mockPrisma.featureFlag.update.mockResolvedValue({ ...flag, status: FlagStatus.ENABLED });
      await service.update('f1', { status: FlagStatus.ENABLED });
      expect(mockRedis.del).toHaveBeenCalledWith('feature_flag:k1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggle', () => {
    it('toggles status and invalidates cache', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.DISABLED };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
      mockPrisma.featureFlag.update.mockResolvedValue({ ...flag, status: FlagStatus.ENABLED });
      await service.toggle('f1', { status: FlagStatus.ENABLED });
      expect(mockRedis.del).toHaveBeenCalledWith('feature_flag:k1');
    });
  });

  describe('remove', () => {
    it('deletes flag and invalidates cache', async () => {
      const flag = { id: 'f1', key: 'k1' };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
      mockPrisma.featureFlag.delete.mockResolvedValue({});
      const result = await service.remove('f1');
      expect(result).toEqual({ success: true });
      expect(mockRedis.del).toHaveBeenCalledWith('feature_flag:k1');
    });
  });

  describe('isEnabled', () => {
    it('returns true when flag is ENABLED', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.ENABLED };
      mockRedis.get.mockResolvedValue(JSON.stringify(flag));
      expect(await service.isEnabled('k1')).toBe(true);
    });

    it('returns false when flag is DISABLED', async () => {
      const flag = { id: 'f1', key: 'k1', status: FlagStatus.DISABLED };
      mockRedis.get.mockResolvedValue(JSON.stringify(flag));
      expect(await service.isEnabled('k1')).toBe(false);
    });

    it('returns false when flag does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      expect(await service.isEnabled('missing')).toBe(false);
    });
  });
});
