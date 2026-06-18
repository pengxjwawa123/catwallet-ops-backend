import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RequestUser } from '../strategies/jwt.strategy';

const CACHE_TTL = 60; // seconds

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // no permission annotation — authenticated is enough

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user) return false;

    // superadmin short-circuit
    if (user.roles.includes('superadmin')) return true;

    const perms = await this.getUserPermissions(user.userId);
    if (!perms.has(required)) {
      throw new ForbiddenException(`Permission required: ${required}`);
    }
    return true;
  }

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `perms:${userId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return new Set<string>(JSON.parse(cached));
      } catch {
        // corrupt cache — fall through to DB
      }
    }

    // Load from DB
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

    const perms = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.opsRole.rolePermissions) {
        perms.add(`${rp.opsPermission.resource}:${rp.opsPermission.action}`);
      }
    }

    // Write to cache (non-blocking)
    this.redis
      .set(cacheKey, JSON.stringify([...perms]), CACHE_TTL)
      .catch((e) => this.logger.warn(`Cache write failed: ${e.message}`));

    return perms;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.redis.del(`perms:${userId}`);
  }

  async invalidateRoleCache(roleId: string): Promise<void> {
    // Find all users with this role and invalidate their cache
    const userRoles = await this.prisma.opsUserRole.findMany({
      where: { opsRoleId: roleId },
      select: { opsUserId: true },
    });
    const keys = userRoles.map((ur) => `perms:${ur.opsUserId}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
