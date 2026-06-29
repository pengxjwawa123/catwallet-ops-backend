import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RequestUser } from '../strategies/jwt.strategy';
import { PermissionResolverService, SUPERADMIN_ROLE } from '../permission-resolver.service';

// Re-exported for callers that historically imported it from the guard.
export { SUPERADMIN_ROLE };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolverService,
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
    if (!user) throw new UnauthorizedException();

    // Authorization is resolved from the DB (cached), NOT from the JWT, so a
    // revoked role / removed permission takes effect within the cache TTL
    // rather than lasting the whole access-token lifetime.
    const authz = await this.resolver.getUserAuthz(user.userId);

    // superadmin short-circuit — DB-backed
    if (authz.roles.has(SUPERADMIN_ROLE)) return true;

    if (!authz.permissions.has(required)) {
      throw new ForbiddenException(`Permission required: ${required}`);
    }
    return true;
  }
}
