import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
  },
};

function makeContext(method: string, path: string, user?: any, body?: any): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        route: { path },
        url: path,
        params: {},
        body: body ?? { field: 'value' },
        headers: { 'user-agent': 'jest' },
        socket: { remoteAddress: '127.0.0.1' },
        user,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  const reflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    jest.clearAllMocks();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  });

  it('does not write audit log for GET requests', (done) => {
    const ctx = makeContext('GET', '/ops-users', { userId: 'u1', username: 'admin' });
    const next = { handle: () => of({ id: '123' }) };
    interceptor.intercept(ctx, next as any).subscribe({
      complete: () => {
        expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('writes audit log for POST requests', (done) => {
    mockPrisma.auditLog.create.mockResolvedValue({});
    const ctx = makeContext('POST', '/ops-users', { userId: 'u1', username: 'admin', roles: ['superadmin'] });
    const next = { handle: () => of({ id: 'new-user-id' }) };
    interceptor.intercept(ctx, next as any).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                actorId: 'u1',
                actorName: 'admin',
                action: 'POST /ops-users',
                target: 'ops-users',
              }),
            }),
          );
          done();
        }, 50);
      },
    });
  });

  it('does not write audit log for health endpoints', (done) => {
    const ctx = makeContext('POST', '/health', undefined);
    const next = { handle: () => of({}) };
    interceptor.intercept(ctx, next as any).subscribe({
      complete: () => {
        expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('does not write audit log for /auth/logout (contains refreshToken)', (done) => {
    const ctx = makeContext('POST', '/auth/logout', { userId: 'u1', username: 'admin' }, { refreshToken: 'secret-token' });
    const next = { handle: () => of({}) };
    interceptor.intercept(ctx, next as any).subscribe({
      complete: () => {
        expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('strips sensitive keys from request body before writing audit log', (done) => {
    mockPrisma.auditLog.create.mockResolvedValue({});
    const body = { username: 'alice', password: 'secret', newPassword: 'newsecret', refreshToken: 'tok' };
    const ctx = makeContext('POST', '/ops-users', { userId: 'u1', username: 'admin', roles: ['superadmin'] }, body);
    const next = { handle: () => of({ id: 'new-id' }) };
    interceptor.intercept(ctx, next as any).subscribe({
      complete: () => {
        setTimeout(() => {
          const callArg = mockPrisma.auditLog.create.mock.calls[0][0];
          const afterJson = callArg.data.afterJson;
          expect(afterJson).not.toHaveProperty('password');
          expect(afterJson).not.toHaveProperty('newPassword');
          expect(afterJson).not.toHaveProperty('refreshToken');
          expect(afterJson).toHaveProperty('username', 'alice');
          done();
        }, 50);
      },
    });
  });

  it('writes a failure audit log when a write operation throws', (done) => {
    mockPrisma.auditLog.create.mockResolvedValue({});
    const ctx = makeContext('POST', '/ops-users', { userId: 'u1', username: 'admin', roles: ['superadmin'] });
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    const next = { handle: () => throwError(() => error) };
    interceptor.intercept(ctx, next as any).subscribe({
      error: () => {
        setTimeout(() => {
          expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                action: 'POST /ops-users',
                afterJson: expect.objectContaining({ status: 'failed' }),
              }),
            }),
          );
          done();
        }, 50);
      },
    });
  });
});
