import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';

const mockPrisma = {
  opsRole: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  opsPermission: { findUnique: jest.fn() },
  opsRolePermission: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  opsUserRole: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  opsUser: { findUnique: jest.fn() },
};

const mockGuard = {
  invalidateRoleCache: jest.fn(),
  invalidateUserCache: jest.fn(),
};

const superadminCaller: RequestUser = {
  userId: 'u-super',
  username: 'superadmin',
  roles: ['superadmin'],
};
const operatorCaller: RequestUser = { userId: 'u-op', username: 'operator', roles: ['operator'] };

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PermissionsGuard, useValue: mockGuard },
      ],
    }).compile();
    service = module.get<RolesService>(RolesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a role when name is unique', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue(null);
      mockPrisma.opsRole.create.mockResolvedValue({ id: 'r1', name: 'editor' });

      const result = await service.create({ name: 'editor' });
      expect(result.name).toBe('editor');
    });

    it('throws ConflictException when name already exists', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r1', name: 'editor' });
      await expect(service.create({ name: 'editor' })).rejects.toThrow(ConflictException);
    });
  });

  describe('assignPermission', () => {
    it('upserts role permission and invalidates cache', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'editor',
        rolePermissions: [],
        _count: { userRoles: 0 },
      });
      mockPrisma.opsPermission.findUnique.mockResolvedValue({
        id: 'p1',
        resource: 'audit',
        action: 'read',
      });
      mockPrisma.opsRolePermission.upsert.mockResolvedValue({});
      mockPrisma.opsUserRole.findMany.mockResolvedValue([]);

      await service.assignPermission('r1', { permissionId: 'p1' }, superadminCaller);

      expect(mockPrisma.opsRolePermission.upsert).toHaveBeenCalled();
      expect(mockGuard.invalidateRoleCache).toHaveBeenCalledWith('r1');
    });

    it('throws NotFoundException when permission not found', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'editor',
        rolePermissions: [],
        _count: { userRoles: 0 },
      });
      mockPrisma.opsPermission.findUnique.mockResolvedValue(null);
      await expect(
        service.assignPermission('r1', { permissionId: 'bad' }, superadminCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-superadmin tries to grant rbac:manage', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'editor',
        rolePermissions: [],
        _count: { userRoles: 0 },
      });
      mockPrisma.opsPermission.findUnique.mockResolvedValue({
        id: 'p2',
        resource: 'rbac',
        action: 'manage',
      });

      await expect(
        service.assignPermission('r1', { permissionId: 'p2' }, operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows superadmin to grant rbac:manage', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'editor',
        rolePermissions: [],
        _count: { userRoles: 0 },
      });
      mockPrisma.opsPermission.findUnique.mockResolvedValue({
        id: 'p2',
        resource: 'rbac',
        action: 'manage',
      });
      mockPrisma.opsRolePermission.upsert.mockResolvedValue({});
      mockPrisma.opsUserRole.findMany.mockResolvedValue([]);

      await expect(
        service.assignPermission('r1', { permissionId: 'p2' }, superadminCaller),
      ).resolves.toEqual({ success: true });
    });
  });

  describe('assignRoleToUser', () => {
    it('upserts user role and invalidates user cache', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r1', name: 'operator' });
      mockPrisma.opsUserRole.upsert.mockResolvedValue({});

      await service.assignRoleToUser('u1', { roleId: 'r1' }, superadminCaller);

      expect(mockPrisma.opsUserRole.upsert).toHaveBeenCalled();
      expect(mockGuard.invalidateUserCache).toHaveBeenCalledWith('u1');
    });

    it('throws ForbiddenException when non-superadmin tries to assign superadmin role', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r-super', name: 'superadmin' });

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-super' }, operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows superadmin to assign superadmin role', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r-super', name: 'superadmin' });
      mockPrisma.opsUserRole.upsert.mockResolvedValue({});

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-super' }, superadminCaller),
      ).resolves.toEqual({ success: true });
    });
  });
});
