import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../auth/strategies/jwt.strategy';
import { AUDIT_ACTION_KEY } from './audit-action.decorator';

const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SKIP_PATHS = ['/health', '/auth/login', '/auth/refresh', '/auth/logout'];

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'refreshToken',
  'token',
  'secret',
  'twoFASecret',
  'accessToken',
]);

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SENSITIVE_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method?.toUpperCase() ?? '';
    const path: string = req.route?.path ?? req.url ?? '';

    const shouldAudit =
      !SKIP_METHODS.has(method) &&
      !SKIP_PATHS.some((p) => path.startsWith(p));

    if (!shouldAudit) return next.handle();

    const customAction = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          this.writeAuditLog(req, method, path, customAction, responseData, null).catch((e) =>
            this.logger.warn(`Audit write failed: ${e?.message}`),
          );
        },
      }),
      catchError((err) => {
        this.writeAuditLog(req, method, path, customAction, null, err).catch((e) =>
          this.logger.warn(`Audit write failed: ${e?.message}`),
        );
        return throwError(() => err);
      }),
    );
  }

  private async writeAuditLog(
    req: any,
    method: string,
    path: string,
    customAction: string | undefined,
    responseData: any,
    error: any,
  ) {
    const user: RequestUser | undefined = req.user;
    const params = req.params ?? {};

    const action = customAction ?? `${method} ${path}`;

    const segments = path.replace(/^\//, '').split('/');
    const target = segments[0] ?? undefined;
    const targetId =
      params.id ??
      params.userId ??
      params.roleId ??
      params.permissionId ??
      undefined;

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      undefined;
    const userAgent = req.headers['user-agent'] ?? undefined;

    let afterJson: object | undefined;
    try {
      const body = req.body ?? {};
      const safeBody = stripSensitive(body as Record<string, unknown>);
      const responseId =
        typeof responseData === 'object' && responseData !== null
          ? (responseData.id ?? undefined)
          : undefined;

      if (error) {
        const errorSummary = error?.message ?? 'Unknown error';
        const status = error?.status ?? error?.statusCode ?? 500;
        afterJson = Object.keys(safeBody).length > 0
          ? { ...safeBody, status: 'failed', error: errorSummary, httpStatus: status }
          : { status: 'failed', error: errorSummary, httpStatus: status };
      } else {
        afterJson = Object.keys(safeBody).length > 0 ? { ...safeBody, responseId } : { responseId };
      }
    } catch {
      afterJson = undefined;
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user?.userId ?? null,
        actorName: user?.username ?? null,
        action,
        target: target ?? null,
        targetId: targetId ?? null,
        afterJson: afterJson ?? undefined,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }
}
