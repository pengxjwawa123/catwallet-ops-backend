import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertI18nKeyDto } from './dto/i18n.dto';

const CACHE_KEY = 'i18n:config';
const CACHE_TTL = 300;

function sortedRepresentation(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .map((key) => {
        const v = obj[key];
        if (!v) return null;
        return `${key}=${sortedRepresentation(v)}`;
      })
      .filter((item): item is string => item !== null)
      .join('&');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sortedRepresentation(item)).join(',');
  }
  return String(value);
}

function generateSignature(
  params: Record<string, unknown>,
  secretKey: string,
): string {
  const filtered = { ...params };
  delete filtered.signature;
  const queryString = sortedRepresentation(filtered);
  const hmac = createHmac('sha256', secretKey);
  hmac.update(queryString);
  return hmac.digest('base64');
}

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecretKey: string;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiBaseUrl = this.config.get<string>('CATWALLET_API_BASE_URL') || '';
    this.apiKey = this.config.get<string>('CATWALLET_API_KEY') || '';
    this.apiSecretKey = this.config.get<string>('CATWALLET_API_SECRET_KEY') || '';
  }

  async getConfig(language?: string) {
    const cacheKey = language ? `${CACHE_KEY}:${language}` : CACHE_KEY;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let url: string;
    try {
      url = new URL('/gt/wallet/api/discover/i18n/config', this.apiBaseUrl).toString();
    } catch {
      this.logger.error('CATWALLET_API_BASE_URL must be an absolute URL');
      return { langs: {} };
    }

    const timestamp = Date.now().toString();
    const body: Record<string, unknown> = { timestamp };
    if (language) body.language = language;

    const signature = generateSignature(body, this.apiSecretKey);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': this.apiKey,
        'X-Signature': signature,
        'X-Timestamp': timestamp,
        'X-Platform': 'extension',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.error(`Failed to fetch i18n config: ${response.status} ${response.statusText}`);
      return { langs: {} };
    }

    const json = await response.json();
    if (json?.code && json.code !== '200') {
      this.logger.error(`Plugin API error: ${json.code} - ${json.message}`);
      return { langs: {} };
    }

    const result = json?.data ?? json;
    await this.redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async findAll(page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      this.prisma.i18nEntry.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ key: 'asc' }, { language: 'asc' }],
      }),
      this.prisma.i18nEntry.count(),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByKey(key: string) {
    const entries = await this.prisma.i18nEntry.findMany({ where: { key } });
    if (!entries.length) throw new NotFoundException(`Key "${key}" not found`);
    const translations: Record<string, string> = {};
    for (const e of entries) translations[e.language] = e.value;
    return { key, translations, entries };
  }

  async findOne(id: string) {
    const entry = await this.prisma.i18nEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Entry ${id} not found`);
    return entry;
  }

  async upsertKey(dto: UpsertI18nKeyDto) {
    const ops = Object.entries(dto.translations).map(([language, value]) =>
      this.prisma.i18nEntry.upsert({
        where: { key_language: { key: dto.key, language } },
        create: { key: dto.key, language, value },
        update: { value },
      }),
    );
    const results = await this.prisma.$transaction(ops);
    await this.invalidateCache();
    return results;
  }

  async create(dto: { key: string; language: string; value: string }) {
    const result = await this.prisma.i18nEntry.create({ data: dto });
    await this.invalidateCache();
    return result;
  }

  async update(id: string, dto: { value?: string }) {
    const entry = await this.prisma.i18nEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Entry ${id} not found`);
    const result = await this.prisma.i18nEntry.update({ where: { id }, data: dto });
    await this.invalidateCache();
    return result;
  }

  async removeByKey(key: string) {
    const { count } = await this.prisma.i18nEntry.deleteMany({ where: { key } });
    if (!count) throw new NotFoundException(`Key "${key}" not found`);
    await this.invalidateCache();
    return { deleted: count };
  }

  async remove(id: string) {
    const entry = await this.prisma.i18nEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Entry ${id} not found`);
    await this.prisma.i18nEntry.delete({ where: { id } });
    await this.invalidateCache();
    return entry;
  }

  private async invalidateCache() {
    await this.redis.del(CACHE_KEY);
  }

  async writeOpLog(action: string, operator: string | null, key: string | null, detail?: unknown) {
    return this.prisma.i18nOpLog.create({
      data: {
        action,
        operator,
        key,
        detail: detail as any ?? undefined,
      },
    });
  }

  async getOpLogs(page = 1, pageSize = 20, action?: string, key?: string) {
    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (key) where.key = { contains: key, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.i18nOpLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.i18nOpLog.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
