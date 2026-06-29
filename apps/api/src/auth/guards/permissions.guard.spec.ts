import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionResolverService } from '../permission-resolver.service';

const mockResolver = {
  getUserAuthz: jest.fn(),
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
        { provide: PermissionResolverService, useValue: mockResolver },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = module.get<PermissionsGuard>(PermissionsGuard);
    jest.clearAllMocks();
  });

  it('allows @Public() routes without resolving authz', async () => {
    const ctx = makeContext({ isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockResolver.getUserAuthz).not.toHaveBeenCalled();
  });

  it('allows routes without @RequirePermission when user is authenticated', async () => {
    const ctx = makeContext({ user: { userId: 'u1', username: 'alice', roles: [] } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockResolver.getUserAuthz).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when no user is present on a guarded route', async () => {
    const ctx = makeContext({ permission: 'audit:read', user: undefined });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('allows superadmin resolved from the DB (not the JWT)', async () => {
    // JWT carries no superadmin role; the resolver (DB-backed) says it does.
    mockResolver.getUserAuthz.mockResolvedValue({
      roles: new Set(['superadmin']),
      permissions: new Set<string>(),
    });
    const ctx = makeContext({
      permission: 'rbac:manage',
      user: { userId: 'u1', username: 'admin', roles: [] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies a user whose JWT claims superadmin but whose DB role was revoked', async () => {
    mockResolver.getUserAuthz.mockResolvedValue({
      roles: new Set(['operator']),
      permissions: new Set(['audit:read']),
    });
    const ctx = makeContext({
      permission: 'rbac:manage',
      user: { userId: 'u1', username: 'admin', roles: ['superadmin'] },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('returns true when the user holds the required permission', async () => {
    mockResolver.getUserAuthz.mockResolvedValue({
      roles: new Set(['operator']),
      permissions: new Set(['audit:read', 'ops_user:read']),
    });
    const ctx = makeContext({
      permission: 'audit:read',
      user: { userId: 'u2', username: 'op', roles: ['operator'] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when the user lacks the required permission', async () => {
    mockResolver.getUserAuthz.mockResolvedValue({
      roles: new Set(['operator']),
      permissions: new Set(['ops_user:read']),
    });
    const ctx = makeContext({
      permission: 'rbac:manage',
      user: { userId: 'u2', username: 'op', roles: ['operator'] },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
