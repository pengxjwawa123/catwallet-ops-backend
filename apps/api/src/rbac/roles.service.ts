import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto, AssignRoleDto } from './dto/rbac.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsGuard: PermissionsGuard,
  ) {}

  async findAll() {
    return this.prisma.opsRole.findMany({
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: { include: { opsPermission: true } },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.opsRole.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { opsPermission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.opsRole.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role name already exists');

    const role = await this.prisma.opsRole.create({
      data: { name: dto.name, description: dto.description },
    });
    this.logger.log(`Role created: ${role.name}`);
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    return this.prisma.opsRole.update({ where: { id }, data: { description: dto.description } });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Invalidate cache for all users in this role before deletion
    await this.permissionsGuard.invalidateRoleCache(id);
    await this.prisma.opsRole.delete({ where: { id } });
    return { success: true };
  }

  async assignPermission(roleId: string, dto: AssignPermissionDto, caller: RequestUser) {
    await this.findOne(roleId);
    const perm = await this.prisma.opsPermission.findUnique({ where: { id: dto.permissionId } });
    if (!perm) throw new NotFoundException('Permission not found');

    // Prevent non-superadmins from granting rbac:manage (privilege escalation)
    if (perm.resource === 'rbac' && perm.action === 'manage') {
      if (!caller.roles.includes('superadmin')) {
        throw new ForbiddenException('Only a superadmin may grant the rbac:manage permission');
      }
    }

    await this.prisma.opsRolePermission.upsert({
      where: { opsRoleId_opsPermissionId: { opsRoleId: roleId, opsPermissionId: dto.permissionId } },
      update: {},
      create: { opsRoleId: roleId, opsPermissionId: dto.permissionId },
    });

    await this.permissionsGuard.invalidateRoleCache(roleId);
    this.logger.log(`Permission ${perm.resource}:${perm.action} assigned to role ${roleId}`);
    return { success: true };
  }

  async removePermission(roleId: string, permissionId: string) {
    await this.findOne(roleId);
    await this.prisma.opsRolePermission.deleteMany({
      where: { opsRoleId: roleId, opsPermissionId: permissionId },
    });
    await this.permissionsGuard.invalidateRoleCache(roleId);
    return { success: true };
  }

  async assignRoleToUser(userId: string, dto: AssignRoleDto, caller: RequestUser) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.prisma.opsRole.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Prevent non-superadmins from granting the superadmin role (privilege escalation)
    if (role.name === 'superadmin' && !caller.roles.includes('superadmin')) {
      throw new ForbiddenException('Only a superadmin may grant the superadmin role');
    }

    await this.prisma.opsUserRole.upsert({
      where: { opsUserId_opsRoleId: { opsUserId: userId, opsRoleId: dto.roleId } },
      update: {},
      create: { opsUserId: userId, opsRoleId: dto.roleId },
    });

    await this.permissionsGuard.invalidateUserCache(userId);
    this.logger.log(`Role ${role.name} assigned to user ${userId}`);
    return { success: true };
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    await this.prisma.opsUserRole.deleteMany({ where: { opsUserId: userId, opsRoleId: roleId } });
    await this.permissionsGuard.invalidateUserCache(userId);
    return { success: true };
  }
}
