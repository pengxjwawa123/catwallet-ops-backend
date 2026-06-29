import { Test, TestingModule } from '@nestjs/testing';
import { PermissionResolverService } from './permission-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const mockPrisma = {
  opsUserRole: { findMany: jest.fn() },
  opsUser: { findMany: jest.fn() },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('PermissionResolverService', () => {
  let resolver: PermissionResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionResolverService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    resolver = module.get<PermissionResolverService>(PermissionResolverService);
    jest.clearAllMocks();
  });

  describe('getUserAuthz', () => {
    it('loads roles + permissions from the DB on a cache miss and writes the cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);
      mockPrisma.opsUserRole.findMany.mockResolvedValue([
        {
          opsRole: {
            name: 'operator',
            rolePermissions: [{ opsPermission: { resource: 'audit', action: 'read' } }],
          },
        },
      ]);

      const authz = await resolver.getUserAuthz('u1');

      expect(authz.roles.has('operator')).toBe(true);
      expect(authz.permissions.has('audit:read')).toBe(true);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('serves from cache without a DB hit', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ roles: ['operator'], permissions: ['audit:read'] }),
      );

      const authz = await resolver.getUserAuthz('u1');

      expect(authz.permissions.has('audit:read')).toBe(true);
      expect(mockPrisma.opsUserRole.findMany).not.toHaveBeenCalled();
    });

    it('falls through to the DB when the cache entry is corrupt', async () => {
      mockRedis.get.mockResolvedValue('not-json');
      mockRedis.set.mockResolvedValue(undefined);
      mockPrisma.opsUserRole.findMany.mockResolvedValue([]);

      const authz = await resolver.getUserAuthz('u1');

      expect(authz.permissions.size).toBe(0);
      expect(mockPrisma.opsUserRole.findMany).toHaveBeenCalled();
    });

    it('still resolves when the cache write rejects', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      mockPrisma.opsUserRole.findMany.mockResolvedValue([
        { opsRole: { name: 'operator', rolePermissions: [] } },
      ]);

      const authz = await resolver.getUserAuthz('u1');
      expect(authz.roles.has('operator')).toBe(true);
    });
  });

  describe('invalidateRoleCache', () => {
    it('deletes all member keys in a single call', async () => {
      mockPrisma.opsUserRole.findMany.mockResolvedValue([
        { opsUserId: 'a' },
        { opsUserId: 'b' },
      ]);
      await resolver.invalidateRoleCache('r1');
      expect(mockRedis.del).toHaveBeenCalledWith('authz:v2:a', 'authz:v2:b');
    });

    it('does not call del when the role has no members', async () => {
      mockPrisma.opsUserRole.findMany.mockResolvedValue([]);
      await resolver.invalidateRoleCache('r1');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAllCaches', () => {
    it('deletes every user key in a single batched call', async () => {
      mockPrisma.opsUser.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      await resolver.invalidateAllCaches();
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith('authz:v2:a', 'authz:v2:b', 'authz:v2:c');
    });
  });
});
