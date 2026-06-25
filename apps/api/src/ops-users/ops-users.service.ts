import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateOpsUserDto,
  UpdateOpsUserDto,
  ResetPasswordDto,
  SetStatusDto,
} from './dto/ops-user.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { UserStatus } from '@prisma/client';

@Injectable()
export class OpsUsersService {
  private readonly logger = new Logger(OpsUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOpsUserDto, caller: RequestUser) {
    const existing = await this.prisma.opsUser.findUnique({
      where: { username: dto.username },
    });
    if (existing) throw new ConflictException('Username already exists');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.opsUser.create({
      data: {
        username: dto.username,
        email: dto.email ?? null,
        passwordHash,
      },
    });

    if (dto.roleName) {
      const role = await this.prisma.opsRole.findUnique({
        where: { name: dto.roleName },
      });
      if (role) {
        await this.prisma.opsUserRole.create({
          data: { opsUserId: user.id, opsRoleId: role.id },
        });
      }
    }

    this.logger.log(`User created: ${user.username} by ${caller.username}`);
    return this.sanitize(user);
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.opsUser.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { userRoles: { include: { opsRole: true } } },
      }),
      this.prisma.opsUser.count(),
    ]);

    return {
      items: items.map((u) => this.sanitize(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.opsUser.findUnique({
      where: { id },
      include: { userRoles: { include: { opsRole: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateOpsUserDto, _caller: RequestUser) {
    // Guard already enforces ops_user:update permission; self-edit is always allowed
    const user = await this.prisma.opsUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.opsUser.update({
      where: { id },
      data: { email: dto.email },
    });
    return this.sanitize(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, caller: RequestUser) {
    const user = await this.prisma.opsUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.opsUser.update({ where: { id }, data: { passwordHash } });

    await this.prisma.refreshToken.updateMany({
      where: { opsUserId: id, revoked: false },
      data: { revoked: true },
    });

    this.logger.log(`Password reset for user ${id} by ${caller.username}`);
    return { success: true };
  }

  async setStatus(id: string, dto: SetStatusDto, caller: RequestUser) {
    const user = await this.prisma.opsUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.opsUser.update({
      where: { id },
      data: { status: dto.status as UserStatus },
    });

    if (dto.status !== 'ACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { opsUserId: id, revoked: false },
        data: { revoked: true },
      });
    }

    this.logger.log(`User ${id} status set to ${dto.status} by ${caller.username}`);
    return this.sanitize(updated);
  }

  async remove(id: string, caller: RequestUser) {
    const user = await this.prisma.opsUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.opsUser.delete({ where: { id } });
    this.logger.log(`User ${id} deleted by ${caller.username}`);
    return { success: true };
  }

  private sanitize(user: any) {
    const { passwordHash, twoFASecret, ...rest } = user;
    void passwordHash;
    void twoFASecret;
    return rest;
  }
}
