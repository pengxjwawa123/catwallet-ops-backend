import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { RemoteConfigsService } from './remote-configs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const mockPrisma = {
  remoteConfig: {
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

describe('RemoteConfigsService', () => {
  let service: RemoteConfigsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteConfigsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<RemoteConfigsService>(RemoteConfigsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a config entry', async () => {
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(null);
      mockPrisma.remoteConfig.create.mockResolvedValue({
        id: 'r1',
        key: 'max-size',
        value: '10MB',
      });
      const result = await service.create({ key: 'max-size', value: '10MB' });
      expect(result).toHaveProperty('key', 'max-size');
    });

    it('throws ConflictException when key already exists', async () => {
      mockPrisma.remoteConfig.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(service.create({ key: 'dup', value: 'v' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findByKey', () => {
    it('returns cached value when present', async () => {
      const cfg = { id: 'r1', key: 'k1', value: 'v1' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cfg));
      const result = await service.findByKey('k1');
      expect(result.value).toBe('v1');
      expect(mockPrisma.remoteConfig.findUnique).not.toHaveBeenCalled();
    });

    it('fetches from DB and caches on miss', async () => {
      const cfg = { id: 'r1', key: 'k1', value: 'v1' };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(cfg);
      await service.findByKey('k1');
      expect(mockRedis.set).toHaveBeenCalledWith('remote_config:k1', JSON.stringify(cfg), 60);
    });

    it('throws NotFoundException when not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(null);
      await expect(service.findByKey('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates config and invalidates cache', async () => {
      const cfg = { id: 'r1', key: 'k1', value: 'old' };
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(cfg);
      mockPrisma.remoteConfig.update.mockResolvedValue({ ...cfg, value: 'new' });
      await service.update('r1', { value: 'new' });
      expect(mockRedis.del).toHaveBeenCalledWith('remote_config:k1');
    });
  });

  describe('remove', () => {
    it('deletes config and invalidates cache', async () => {
      const cfg = { id: 'r1', key: 'k1', value: 'v' };
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(cfg);
      mockPrisma.remoteConfig.delete.mockResolvedValue({});
      const result = await service.remove('r1');
      expect(result).toEqual({ success: true });
      expect(mockRedis.del).toHaveBeenCalledWith('remote_config:k1');
    });
  });
});
