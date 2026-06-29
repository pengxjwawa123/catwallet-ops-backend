import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL = 60; // seconds
// Bumped to v2 when the cache payload changed from a bare permission array
// to { roles, permissions }. Old v1 keys are simply ignored and expire.
const CACHE_PREFIX = 'authz:v2:';

export const SUPERADMIN_ROLE = 'superadmin';

export interface UserAuthz {
  roles: Set<string>;
  permissions: Set<string>;
}

/**
 * Single source of truth for authorization data. Owns the DB lookup + Redis
 * cache for a user's effective roles and permissions, and all cache
 * invalidation. The PermissionsGuard and the RBAC services depend on this
 * rather than on each other, so authorization policy is not coupled to the
 * HTTP pipeline.
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private key(userId: string): string {
    return `${CACHE_PREFIX}${userId}`;
  }

  /**
   * Resolve a user's effective roles + permissions from the DB, with a short
   * Redis cache. Callers must not trust JWT-embedded roles.
   */
  async getUserAuthz(userId: string): Promise<UserAuthz> {
    const cacheKey = this.key(userId);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { roles: string[]; permissions: string[] };
        return {
          roles: new Set(parsed.roles ?? []),
          permissions: new Set(parsed.permissions ?? []),
        };
      } catch {
        // corrupt cache — fall through to DB
      }
    }

    const userRoles = await this.prisma.opsUserRole.findMany({
      where: { opsUserId: userId },
      include: {
        opsRole: {
          include: {
            rolePermissions: {
              include: { opsPermission: true },
            },
          },
        },
      },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const ur of userRoles) {
      roles.add(ur.opsRole.name);
      for (const rp of ur.opsRole.rolePermissions) {
        permissions.add(`${rp.opsPermission.resource}:${rp.opsPermission.action}`);
      }
    }

    // Write to cache (non-blocking)
    this.redis
      .set(cacheKey, JSON.stringify({ roles: [...roles], permissions: [...permissions] }), CACHE_TTL)
      .catch((e) => this.logger.warn(`Cache write failed: ${e.message}`));

    return { roles, permissions };
  }

  /** Effective permission strings for a user (DB-backed, cached). */
  async getUserPermissions(userId: string): Promise<Set<string>> {
    return (await this.getUserAuthz(userId)).permissions;
  }

  /** Effective role names for a user (DB-backed, cached). */
  async getUserRoles(userId: string): Promise<Set<string>> {
    return (await this.getUserAuthz(userId)).roles;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  async invalidateRoleCache(roleId: string): Promise<void> {
    const userRoles = await this.prisma.opsUserRole.findMany({
      where: { opsRoleId: roleId },
      select: { opsUserId: true },
    });
    const keys = userRoles.map((ur) => this.key(ur.opsUserId));
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /** Invalidate every user's cache in a single Redis round trip. */
  async invalidateAllCaches(): Promise<void> {
    const users = await this.prisma.opsUser.findMany({ select: { id: true } });
    const keys = users.map((u) => this.key(u.id));
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
