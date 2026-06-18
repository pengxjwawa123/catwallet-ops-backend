import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OpsUsersService } from './ops-users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/strategies/jwt.strategy';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const mockPrisma = {
  opsUser: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  opsRole: { findUnique: jest.fn() },
  opsUserRole: { create: jest.fn() },
  refreshToken: { updateMany: jest.fn() },
};

const superadminCaller: RequestUser = { userId: 'u-super', username: 'admin', roles: ['superadmin'] };
const operatorCaller: RequestUser = { userId: 'u-op', username: 'operator', roles: ['operator'] };

describe('OpsUsersService', () => {
  let service: OpsUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpsUsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<OpsUsersService>(OpsUsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a user (any caller with ops_user:create — guard already enforced)', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(null);
      mockPrisma.opsUser.create.mockResolvedValue({ id: 'u1', username: 'alice', email: null, userRoles: [] });

      const result = await service.create({ username: 'alice', password: 'pw' }, operatorCaller);
      expect(result).toHaveProperty('username', 'alice');
    });

    it('throws ConflictException when username already exists', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.create({ username: 'alice', password: 'pw' }, superadminCaller)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated users without requiring superadmin', async () => {
      mockPrisma.opsUser.findMany.mockResolvedValue([]);
      mockPrisma.opsUser.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total', 0);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when user not found', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows any caller with ops_user:update permission to update any user', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1', username: 'alice' });
      mockPrisma.opsUser.update.mockResolvedValue({ id: 'u1', username: 'alice', email: 'new@ex.com' });

      const result = await service.update('u1', { email: 'new@ex.com' }, operatorCaller);
      expect(result).toHaveProperty('email', 'new@ex.com');
    });

    it('throws NotFoundException when target user not found', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', { email: 'x@x.com' }, operatorCaller)).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('resets password for any caller with ops_user:update permission', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsUser.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      const result = await service.resetPassword('u1', { newPassword: 'newpw' }, operatorCaller);
      expect(result).toEqual({ success: true });
    });
  });

  describe('setStatus', () => {
    it('sets user status for any caller with ops_user:update permission', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsUser.update.mockResolvedValue({ id: 'u1', status: 'INACTIVE' });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      const result = await service.setStatus('u1', { status: 'INACTIVE' }, operatorCaller);
      expect(result).toHaveProperty('status', 'INACTIVE');
    });
  });

  describe('remove', () => {
    it('deletes user for any caller with ops_user:delete permission', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsUser.delete.mockResolvedValue({});

      const result = await service.remove('u1', operatorCaller);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id', operatorCaller)).rejects.toThrow(NotFoundException);
    });
  });
});
