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
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  ToggleFeatureFlagDto,
} from './dto/feature-flag.dto';
import { FlagStatus, Prisma } from '@prisma/client';

const CACHE_TTL = 60; // seconds
const cacheKey = (key: string) => `feature_flag:${key}`;

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateFeatureFlagDto) {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new ConflictException(`Flag key '${dto.key}' already exists`);

    return this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        description: dto.description,
        status: dto.status ?? FlagStatus.DISABLED,
        payload: dto.payload !== undefined ? (dto.payload as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.featureFlag.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.featureFlag.count(),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }

  async findByKey(key: string) {
    const cached = await this.redis.get(cacheKey(key));
    if (cached) {
      return JSON.parse(cached);
    }
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
    await this.redis.set(cacheKey(key), JSON.stringify(flag), CACHE_TTL);
    return flag;
  }

  async update(id: string, dto: UpdateFeatureFlagDto) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        description: dto.description,
        status: dto.status,
        payload: dto.payload !== undefined ? (dto.payload as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.redis.del(cacheKey(flag.key));
    return updated;
  }

  async toggle(id: string, dto: ToggleFeatureFlagDto) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.redis.del(cacheKey(flag.key));
    return updated;
  }

  async remove(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    await this.prisma.featureFlag.delete({ where: { id } });
    await this.redis.del(cacheKey(flag.key));
    this.logger.log(`Feature flag '${flag.key}' deleted`);
    return { success: true };
  }

  /** Utility for other modules: returns true if the flag is ENABLED */
  async isEnabled(key: string): Promise<boolean> {
    try {
      const flag = await this.findByKey(key);
      return flag.status === FlagStatus.ENABLED;
    } catch {
      return false;
    }
  }
}
