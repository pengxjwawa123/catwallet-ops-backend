import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '../common/dto/paginated-result';
import { CreateRemoteConfigDto, UpdateRemoteConfigDto } from './dto/remote-config.dto';

const CACHE_TTL = 60;
const cacheKey = (key: string) => `remote_config:${key}`;

@Injectable()
export class RemoteConfigsService {
  private readonly logger = new Logger(RemoteConfigsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateRemoteConfigDto) {
    const existing = await this.prisma.remoteConfig.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Config key '${dto.key}' already exists`);

    return this.prisma.remoteConfig.create({
      data: { key: dto.key, value: dto.value, description: dto.description },
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.remoteConfig.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.remoteConfig.count(),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const config = await this.prisma.remoteConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Remote config not found');
    return config;
  }

  async findByKey(key: string) {
    const cached = await this.redis.get(cacheKey(key));
    if (cached) return JSON.parse(cached);

    const config = await this.prisma.remoteConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`Remote config '${key}' not found`);
    await this.redis.set(cacheKey(key), JSON.stringify(config), CACHE_TTL);
    return config;
  }

  async update(id: string, dto: UpdateRemoteConfigDto) {
    const config = await this.prisma.remoteConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Remote config not found');

    const updated = await this.prisma.remoteConfig.update({
      where: { id },
      data: { value: dto.value, description: dto.description },
    });
    await this.redis.del(cacheKey(config.key));
    return updated;
  }

  async remove(id: string) {
    const config = await this.prisma.remoteConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Remote config not found');

    await this.prisma.remoteConfig.delete({ where: { id } });
    await this.redis.del(cacheKey(config.key));
    this.logger.log(`Remote config '${config.key}' deleted`);
    return { success: true };
  }
}
