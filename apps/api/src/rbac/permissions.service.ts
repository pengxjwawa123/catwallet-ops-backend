import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionResolverService } from '../auth/permission-resolver.service';
import { CreatePermissionDto } from './dto/rbac.dto';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
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
    await this.resolver.invalidateAllCaches();
    return { success: true };
  }
}
