import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionResolverService } from './permission-resolver.service';
import { RequestUser } from './strategies/jwt.strategy';

// auth.controller → auth.service imports argon2 + otplib at module load; mock
// them so the controller spec can instantiate without the native/ESM deps.
jest.mock('argon2', () => ({ verify: jest.fn(), hash: jest.fn() }));
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verifySync: jest.fn(),
}));

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  setup2FA: jest.fn(),
  enable2FA: jest.fn(),
  verify2FA: jest.fn(),
};

const mockResolver = {
  getUserAuthz: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionResolverService, useValue: mockResolver },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('GET /auth/me', () => {
    const user: RequestUser = { userId: 'u1', username: 'op', roles: ['stale-from-jwt'] };

    it('returns DB-backed roles and permissions, not the JWT roles', async () => {
      mockResolver.getUserAuthz.mockResolvedValue({
        roles: new Set(['operator']),
        permissions: new Set(['audit:read', 'ops_user:read']),
      });

      const result = await controller.me(user);

      expect(mockResolver.getUserAuthz).toHaveBeenCalledWith('u1');
      expect(result.userId).toBe('u1');
      expect(result.username).toBe('op');
      // roles come from the DB authz result, NOT from user.roles (the JWT claim)
      expect(result.roles).toEqual(['operator']);
      expect(result.roles).not.toContain('stale-from-jwt');
      expect(result.permissions.sort()).toEqual(['audit:read', 'ops_user:read']);
    });

    it('returns empty arrays for a user with no roles/permissions', async () => {
      mockResolver.getUserAuthz.mockResolvedValue({
        roles: new Set<string>(),
        permissions: new Set<string>(),
      });

      const result = await controller.me(user);

      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
    });
  });
});
