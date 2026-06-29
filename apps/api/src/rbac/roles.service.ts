import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PermissionResolverService,
  SUPERADMIN_ROLE,
} from '../auth/permission-resolver.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto, AssignRoleDto } from './dto/rbac.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

// Permissions that confer the ability to escalate privileges. Only a superadmin
// may grant or revoke these, regardless of what the caller themselves holds.
const PRIVILEGED_PERMISSIONS = new Set(['rbac:manage', 'role:assign']);

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
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
    // Delete first, then invalidate. Invalidating before the commit leaves a
    // window where a concurrent permission check repopulates the cache from a
    // DB that still has the role attached (stale, over-permissive entries).
    await this.prisma.opsRole.delete({ where: { id } });
    await this.resolver.invalidateRoleCache(id);
    return { success: true };
  }

  // ── Authorization helpers ──────────────────────────────────────────────────

  private isSuperadmin(caller: RequestUser): Promise<boolean> {
    // DB-backed, not JWT-trusted (mirrors PermissionsGuard).
    return this.resolver.getUserRoles(caller.userId).then((roles) => roles.has(SUPERADMIN_ROLE));
  }

  /**
   * A non-superadmin caller may only grant/revoke a permission that is not
   * privilege-bearing AND that the caller themselves holds. This prevents both
   * self-escalation (granting yourself something you lack) and the
   * `rbac:manage`-bootstraps-everything hole.
   */
  private async assertCanMutatePermission(caller: RequestUser, permKey: string, verb: string) {
    if (await this.isSuperadmin(caller)) return;
    if (PRIVILEGED_PERMISSIONS.has(permKey)) {
      throw new ForbiddenException(`Only a superadmin may ${verb} the ${permKey} permission`);
    }
    const callerPerms = await this.resolver.getUserPermissions(caller.userId);
    if (!callerPerms.has(permKey)) {
      throw new ForbiddenException(`You cannot ${verb} a permission you do not hold: ${permKey}`);
    }
  }

  // ── Permission ↔ Role ───────────────────────────────────────────────────────

  async assignPermission(roleId: string, dto: AssignPermissionDto, caller: RequestUser) {
    await this.findOne(roleId);
    const perm = await this.prisma.opsPermission.findUnique({ where: { id: dto.permissionId } });
    if (!perm) throw new NotFoundException('Permission not found');

    await this.assertCanMutatePermission(caller, `${perm.resource}:${perm.action}`, 'grant');

    await this.prisma.opsRolePermission.upsert({
      where: {
        opsRoleId_opsPermissionId: { opsRoleId: roleId, opsPermissionId: dto.permissionId },
      },
      update: {},
      create: { opsRoleId: roleId, opsPermissionId: dto.permissionId },
    });

    await this.resolver.invalidateRoleCache(roleId);
    this.logger.log(`Permission ${perm.resource}:${perm.action} assigned to role ${roleId}`);
    return { success: true };
  }

  async removePermission(roleId: string, permissionId: string, caller: RequestUser) {
    await this.findOne(roleId);
    const perm = await this.prisma.opsPermission.findUnique({ where: { id: permissionId } });
    if (!perm) throw new NotFoundException('Permission not found');

    await this.assertCanMutatePermission(caller, `${perm.resource}:${perm.action}`, 'revoke');

    await this.prisma.opsRolePermission.deleteMany({
      where: { opsRoleId: roleId, opsPermissionId: permissionId },
    });
    await this.resolver.invalidateRoleCache(roleId);
    return { success: true };
  }

  // ── Role ↔ User ──────────────────────────────────────────────────────────────

  async assignRoleToUser(userId: string, dto: AssignRoleDto, caller: RequestUser) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.prisma.opsRole.findUnique({
      where: { id: dto.roleId },
      include: { rolePermissions: { include: { opsPermission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');

    if (!(await this.isSuperadmin(caller))) {
      // Non-superadmins may not grant the superadmin role…
      if (role.name === SUPERADMIN_ROLE) {
        throw new ForbiddenException('Only a superadmin may grant the superadmin role');
      }
      // …nor assign a role carrying permissions they do not themselves hold
      // (would let a delegated admin escalate by assigning a powerful role).
      const callerPerms = await this.resolver.getUserPermissions(caller.userId);
      for (const rp of role.rolePermissions) {
        const key = `${rp.opsPermission.resource}:${rp.opsPermission.action}`;
        if (PRIVILEGED_PERMISSIONS.has(key) || !callerPerms.has(key)) {
          throw new ForbiddenException(
            `You cannot assign a role granting a permission you do not hold: ${key}`,
          );
        }
      }
    }

    await this.prisma.opsUserRole.upsert({
      where: { opsUserId_opsRoleId: { opsUserId: userId, opsRoleId: dto.roleId } },
      update: {},
      create: { opsUserId: userId, opsRoleId: dto.roleId },
    });

    await this.resolver.invalidateUserCache(userId);
    this.logger.log(`Role ${role.name} assigned to user ${userId}`);
    return { success: true };
  }

  async removeRoleFromUser(userId: string, roleId: string, caller: RequestUser) {
    const role = await this.prisma.opsRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Only a superadmin may strip the superadmin role from anyone.
    if (role.name === SUPERADMIN_ROLE && !(await this.isSuperadmin(caller))) {
      throw new ForbiddenException('Only a superadmin may remove the superadmin role');
    }

    // Never allow removing the last superadmin — that would lock everyone out.
    if (role.name === SUPERADMIN_ROLE) {
      const superadminCount = await this.prisma.opsUserRole.count({ where: { opsRoleId: roleId } });
      if (superadminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last superadmin');
      }
    }

    await this.prisma.opsUserRole.deleteMany({ where: { opsUserId: userId, opsRoleId: roleId } });
    await this.resolver.invalidateUserCache(userId);
    return { success: true };
  }
}
