import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

// Mock argon2
jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

// Mock otplib
jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'TESTSECRET'),
  generateURI: jest.fn(() => 'otpauth://totp/test'),
  verifySync: jest.fn(),
}));

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  passwordHash: 'hashed',
  status: 'ACTIVE',
  twoFAEnabled: false,
  twoFASecret: null,
  userRoles: [{ opsRole: { name: 'operator' } }],
};

const mockPrisma = {
  opsUser: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn(() => 'signed-jwt-token'),
};

const mockConfig = {
  get: jest.fn((key: string, def?: string) => {
    const map: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY: '7d',
    };
    return map[key] ?? def;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should return user on valid credentials', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('testuser', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for unknown user', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('ghost', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'INACTIVE',
      });
      // After MEDIUM#5 fix: password check runs first, status check after — still 401 not 403
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.validateUser('testuser', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should issue tokens for user without 2FA', async () => {
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(mockUser, '127.0.0.1', 'test-agent');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.requires2FA).toBe(false);
    });

    it('should return requires2FA flag for user with 2FA enabled', async () => {
      const userWith2FA = { ...mockUser, twoFAEnabled: true };
      const result = await service.login(userWith2FA, '127.0.0.1', 'test-agent');
      expect(result).toEqual({ requires2FA: true, userId: 'user-1' });
    });
  });

  describe('refresh', () => {
    it('should rotate tokens on valid refresh token', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        opsUserId: 'user-1',
        revoked: false,
        expiresAt: futureDate,
      });
      // LOW#10: refresh now uses updateMany for atomic revocation
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.opsUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('raw-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        opsUserId: 'user-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.refresh('raw-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        opsUserId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('raw-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA', () => {
    it('setup2FA should generate secret and otpauth URL', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.opsUser.update.mockResolvedValue({});

      const result = await service.setup2FA('user-1');
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauthUrl');
    });

    it('enable2FA should enable 2FA when TOTP valid', async () => {
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: true });
      mockPrisma.opsUser.findUnique.mockResolvedValue({
        ...mockUser,
        twoFASecret: 'TESTSECRET',
      });
      mockPrisma.opsUser.update.mockResolvedValue({});

      const result = await service.enable2FA('user-1', '123456');
      expect(result).toEqual({ enabled: true });
    });

    it('enable2FA should throw UnauthorizedException on invalid TOTP', async () => {
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: false });
      mockPrisma.opsUser.findUnique.mockResolvedValue({
        ...mockUser,
        twoFASecret: 'TESTSECRET',
      });

      await expect(service.enable2FA('user-1', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
