import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreatePermissionDto } from './dto/rbac.dto';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsGuard: PermissionsGuard,
  ) {}

  async findAll() {
    return this.prisma.opsPermission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findOne(id: string) {
    const perm = await this.prisma.opsPermission.findUnique({ where: { id } });
    if (!perm) throw new NotFoundException('Permission not found');
    return perm;
  }

  async create(dto: CreatePermissionDto) {
    const existing = await this.prisma.opsPermission.findUnique({
      where: { resource_action: { resource: dto.resource, action: dto.action } },
    });
    if (existing) throw new ConflictException('Permission already exists');

    const perm = await this.prisma.opsPermission.create({
      data: { resource: dto.resource, action: dto.action, description: dto.description },
    });
    this.logger.log(`Permission created: ${perm.resource}:${perm.action}`);
    return perm;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.opsPermission.delete({ where: { id } });
    // Invalidate all user caches since a permission was removed (broad but safe)
    await this.invalidateAllCaches();
    return { success: true };
  }

  private async invalidateAllCaches() {
    // Fetch all users and invalidate their permission caches
    const users = await this.prisma.opsUser.findMany({ select: { id: true } });
    for (const u of users) {
      await this.permissionsGuard.invalidateUserCache(u.id);
    }
  }
}
