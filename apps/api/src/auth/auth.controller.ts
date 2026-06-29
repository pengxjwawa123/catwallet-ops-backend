import { Controller, Post, Get, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto } from './dto/login.dto';
import { Enable2FADto, Verify2FADto } from './dto/two-fa.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './strategies/jwt.strategy';
import { PermissionResolverService } from './permission-resolver.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username + password' })
  @ApiResponse({ status: 200, description: 'Returns tokens or requires2FA flag' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const user = await this.authService.validateUser(dto.username, dto.password);
    return this.authService.login(user, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req.ip, req.headers['user-agent']);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user with effective permissions' })
  async me(@CurrentUser() user: RequestUser) {
    const authz = await this.permissionResolver.getUserAuthz(user.userId);
    return {
      userId: user.userId,
      username: user.username,
      roles: [...authz.roles],
      permissions: [...authz.permissions],
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate 2FA secret for current user' })
  async setup2FA(@CurrentUser() user: RequestUser) {
    return this.authService.setup2FA(user.userId);
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA after verifying TOTP token' })
  async enable2FA(@CurrentUser() user: RequestUser, @Body() dto: Enable2FADto) {
    return this.authService.enable2FA(user.userId, dto.token);
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2FA login step' })
  async verify2FA(@Body() dto: Verify2FADto, @Req() req: Request) {
    return this.authService.verify2FA(dto.userId, dto.token, req.ip, req.headers['user-agent']);
  }
}
