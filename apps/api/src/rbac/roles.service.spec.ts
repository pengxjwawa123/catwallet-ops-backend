import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionResolverService } from '../auth/permission-resolver.service';
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
    count: jest.fn(),
  },
  opsUser: { findUnique: jest.fn() },
};

const mockResolver = {
  invalidateRoleCache: jest.fn(),
  invalidateUserCache: jest.fn(),
  getUserRoles: jest.fn(),
  getUserPermissions: jest.fn(),
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
        { provide: PermissionResolverService, useValue: mockResolver },
      ],
    }).compile();
    service = module.get<RolesService>(RolesService);
    jest.clearAllMocks();
    // Default: callers are superadmin unless a test overrides. DB-backed.
    mockResolver.getUserRoles.mockResolvedValue(new Set(['superadmin']));
    mockResolver.getUserPermissions.mockResolvedValue(new Set());
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
      expect(mockResolver.invalidateRoleCache).toHaveBeenCalledWith('r1');
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
      mockResolver.getUserRoles.mockResolvedValue(new Set(['operator']));
      mockResolver.getUserPermissions.mockResolvedValue(new Set(['rbac:manage']));
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
      expect(mockResolver.invalidateUserCache).toHaveBeenCalledWith('u1');
    });

    it('throws ForbiddenException when non-superadmin tries to assign superadmin role', async () => {
      mockResolver.getUserRoles.mockResolvedValue(new Set(['operator']));
      mockResolver.getUserPermissions.mockResolvedValue(new Set());
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r-super',
        name: 'superadmin',
        rolePermissions: [],
      });

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-super' }, operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows superadmin to assign superadmin role', async () => {
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r-super',
        name: 'superadmin',
        rolePermissions: [],
      });
      mockPrisma.opsUserRole.upsert.mockResolvedValue({});

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-super' }, superadminCaller),
      ).resolves.toEqual({ success: true });
    });

    it('blocks a non-superadmin from assigning a role carrying a permission they lack (escalation)', async () => {
      mockResolver.getUserRoles.mockResolvedValue(new Set(['ops-admin']));
      mockResolver.getUserPermissions.mockResolvedValue(new Set(['ops_user:read']));
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r-powerful',
        name: 'powerful',
        rolePermissions: [{ opsPermission: { resource: 'ops_user', action: 'delete' } }],
      });

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-powerful' }, operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a non-superadmin to assign a role whose permissions they all hold', async () => {
      mockResolver.getUserRoles.mockResolvedValue(new Set(['ops-admin']));
      mockResolver.getUserPermissions.mockResolvedValue(
        new Set(['ops_user:read', 'ops_user:update']),
      );
      mockPrisma.opsUser.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r-viewer',
        name: 'viewer',
        rolePermissions: [{ opsPermission: { resource: 'ops_user', action: 'read' } }],
      });
      mockPrisma.opsUserRole.upsert.mockResolvedValue({});

      await expect(
        service.assignRoleToUser('u1', { roleId: 'r-viewer' }, operatorCaller),
      ).resolves.toEqual({ success: true });
    });
  });

  describe('removeRoleFromUser', () => {
    it('blocks a non-superadmin from removing the superadmin role', async () => {
      mockResolver.getUserRoles.mockResolvedValue(new Set(['operator']));
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r-super', name: 'superadmin' });

      await expect(
        service.removeRoleFromUser('u1', 'r-super', operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks removing the last remaining superadmin', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r-super', name: 'superadmin' });
      mockPrisma.opsUserRole.count.mockResolvedValue(1);

      await expect(
        service.removeRoleFromUser('u1', 'r-super', superadminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows superadmin to remove a superadmin when others remain', async () => {
      mockPrisma.opsRole.findUnique.mockResolvedValue({ id: 'r-super', name: 'superadmin' });
      mockPrisma.opsUserRole.count.mockResolvedValue(2);
      mockPrisma.opsUserRole.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.removeRoleFromUser('u1', 'r-super', superadminCaller),
      ).resolves.toEqual({ success: true });
      expect(mockResolver.invalidateUserCache).toHaveBeenCalledWith('u1');
    });
  });

  describe('removePermission', () => {
    it('blocks a non-superadmin from revoking a privileged permission', async () => {
      mockResolver.getUserRoles.mockResolvedValue(new Set(['operator']));
      mockResolver.getUserPermissions.mockResolvedValue(new Set(['rbac:manage']));
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
        service.removePermission('r1', 'p2', operatorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows superadmin to revoke a permission and invalidates cache', async () => {
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
      mockPrisma.opsRolePermission.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.removePermission('r1', 'p1', superadminCaller),
      ).resolves.toEqual({ success: true });
      expect(mockResolver.invalidateRoleCache).toHaveBeenCalledWith('r1');
    });
  });

  describe('remove', () => {
    it('deletes the role before invalidating its cache (ordering)', async () => {
      const calls: string[] = [];
      mockPrisma.opsRole.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'editor',
        rolePermissions: [],
        _count: { userRoles: 0 },
      });
      mockPrisma.opsRole.delete.mockImplementation(async () => {
        calls.push('delete');
        return {};
      });
      mockResolver.invalidateRoleCache.mockImplementation(async () => {
        calls.push('invalidate');
      });

      await service.remove('r1');

      expect(calls).toEqual(['delete', 'invalidate']);
    });
  });
});
