import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OpsUsersModule } from './ops-users/ops-users.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { RedisModule } from './common/redis/redis.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { RemoteConfigsModule } from './remote-configs/remote-configs.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { JobsModule } from './jobs/jobs.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.authorization'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) return { connection: { host: 'localhost', port: 6379 } };
        return { connection: { url } };
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    OpsUsersModule,
    RbacModule,
    AuditModule,
    FeatureFlagsModule,
    RemoteConfigsModule,
    AnnouncementsModule,
    JobsModule,
  ],
  providers: [
    // Guard order: Throttler → JwtAuth → Permissions
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Global audit interceptor
    {
      provide: APP_INTERCEPTOR,
      useFactory: (prisma: PrismaService, reflector: Reflector) =>
        new AuditInterceptor(prisma, reflector),
      inject: [PrismaService, Reflector],
    },
  ],
})
export class AppModule {}
