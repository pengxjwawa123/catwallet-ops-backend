import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verifySync as totpVerifySync } from 'otplib';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginFailures = new Map<string, { count: number; lastAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.opsUser.findUnique({
      where: { username },
      include: {
        userRoles: { include: { opsRole: true } },
      },
    });

    // Always run argon2.verify to prevent timing oracle (dummy hash for unknown users)
    const hashToCheck = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummydummydummydummydummydummy';
    const valid = await argon2.verify(hashToCheck, password);

    if (!user || !valid) {
      this.recordFailure(username);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check status only after password verification passes (avoid user enumeration via early 403)
    if (user.status !== 'ACTIVE') {
      this.recordFailure(username);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginFailures.delete(username);
    return user;
  }

  async login(user: any, ip?: string, userAgent?: string) {
    if (user.twoFAEnabled) {
      return { requires2FA: true, userId: user.id };
    }
    return this.issueTokens(user, ip, userAgent);
  }

  async issueTokens(user: any, ip?: string, userAgent?: string) {
    const roles = (user.userRoles ?? []).map((ur: any) => ur.opsRole.name);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles,
    };

    const accessToken = this.jwtService.sign(payload);

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');
    const expiresAt = this.parseExpiry(refreshExpiry);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        opsUserId: user.id,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh, requires2FA: false };
  }

  async refresh(rawRefreshToken: string, ip?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Atomic revocation: updateMany + count guard prevents concurrent double-use
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
    if (count !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.opsUser.findUnique({
      where: { id: stored.opsUserId },
      include: { userRoles: { include: { opsRole: true } } },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.issueTokens(user, ip, userAgent);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = generateSecret();
    const otpauthUrl = generateURI({ label: user.username, secret, issuer: 'CatWallet Ops' });

    await this.prisma.opsUser.update({
      where: { id: userId },
      data: { twoFASecret: secret },
    });

    return { secret, otpauthUrl };
  }

  async enable2FA(userId: string, token: string) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: userId } });
    if (!user || !user.twoFASecret) {
      throw new UnauthorizedException('2FA not set up');
    }
    const result = totpVerifySync({ token, secret: user.twoFASecret, strategy: 'totp', epochTolerance: 30 });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP token');

    await this.prisma.opsUser.update({
      where: { id: userId },
      data: { twoFAEnabled: true },
    });
    return { enabled: true };
  }

  async verify2FA(userId: string, token: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.opsUser.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { opsRole: true } } },
    });
    if (!user || !user.twoFASecret || !user.twoFAEnabled) {
      throw new UnauthorizedException('2FA not enabled for user');
    }
    const result = totpVerifySync({ token, secret: user.twoFASecret, strategy: 'totp', epochTolerance: 30 });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP token');

    return this.issueTokens(user, ip, userAgent);
  }

  private recordFailure(username: string) {
    const now = Date.now();
    const entry = this.loginFailures.get(username) ?? { count: 0, lastAt: now };
    entry.count += 1;
    entry.lastAt = now;
    this.loginFailures.set(username, entry);
    if (entry.count >= 5) {
      this.logger.warn(
        `Suspicious login activity: ${entry.count} failed attempts for "${username}"`,
      );
    }
  }

  private parseExpiry(expiry: string): Date {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const ms =
      unit === 'd'
        ? value * 86400000
        : unit === 'h'
          ? value * 3600000
          : unit === 'm'
            ? value * 60000
            : value * 1000;
    return new Date(Date.now() + ms);
  }
}
