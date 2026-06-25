import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const mockPrisma = {
  opsUserRole: {
    findMany: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const reflector = new Reflector();

function makeContext(overrides: {
  isPublic?: boolean;
  permission?: string;
  user?: any;
}): ExecutionContext {
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    if (key === 'isPublic') return overrides.isPublic ?? false;
    if (key === 'requirePermission') return overrides.permission;
    return undefined;
  });
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: overrides.user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = module.get<PermissionsGuard>(PermissionsGuard);
    jest.clearAllMocks();
  });

  it('allows @Public() routes without checking permissions', async () => {
    const ctx = makeContext({ isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockPrisma.opsUserRole.findMany).not.toHaveBeenCalled();
  });

  it('allows routes without @RequirePermission when user is authenticated', async () => {
    const ctx = makeContext({ user: { userId: 'u1', username: 'alice', roles: [] } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows superadmin without DB lookup', async () => {
    const ctx = makeContext({
      permission: 'rbac:manage',
      user: { userId: 'u1', username: 'admin', roles: ['superadmin'] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockPrisma.opsUserRole.findMany).not.toHaveBeenCalled();
  });

  it('returns true when user has the required permission (cache miss)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
    mockPrisma.opsUserRole.findMany.mockResolvedValue([
      {
        opsRole: {
          rolePermissions: [{ opsPermission: { resource: 'audit', action: 'read' } }],
        },
      },
    ]);

    const ctx = makeContext({
      permission: 'audit:read',
      user: { userId: 'u2', username: 'op', roles: ['operator'] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns true when user has the required permission (cache hit)', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(['audit:read', 'ops_user:read']));

    const ctx = makeContext({
      permission: 'audit:read',
      user: { userId: 'u2', username: 'op', roles: ['operator'] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockPrisma.opsUserRole.findMany).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when user lacks the required permission', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(['ops_user:read']));

    const ctx = makeContext({
      permission: 'rbac:manage',
      user: { userId: 'u2', username: 'op', roles: ['operator'] },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
