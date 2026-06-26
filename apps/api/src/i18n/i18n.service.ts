import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

const LIST_CACHE_KEY = 'i18n:config:list';
const LIST_CACHE_TTL = 60;

/** A single translation record as returned by the CatWallet i18n API. */
export interface I18nConfigItem {
  id: number;
  platformSource: string;
  configKey: string;
  lang: string;
  value: string;
  version: number;
  createTime: string;
  updateTime: string;
}

interface CatWalletEnvelope<T> {
  code?: string;
  msg?: string;
  data?: T;
}

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly apiBaseUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiBaseUrl = this.config.get<string>('CATWALLET_API_BASE_URL') || '';
    this.apiToken = this.config.get<string>('CATWALLET_API_TOKEN') || '';
  }

  private buildUrl(path: string): string {
    try {
      return new URL(path, this.apiBaseUrl).toString();
    } catch {
      this.logger.error('CATWALLET_API_BASE_URL must be an absolute URL');
      throw new InternalServerErrorException('CatWallet API base URL is not configured');
    }
  }

  private authHeaders(): Record<string, string> {
    // Only attach the Authorization header when a token is configured.
    // The CatWallet i18n endpoints are currently callable without auth; sending
    // an empty `Bearer ` would make the upstream reject the request (→ 502).
    return this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {};
  }

  /**
   * Parse a CatWallet response, unwrapping the { code, msg, data } envelope.
   * Treats a missing code or code === '200' as success.
   */
  private async parseEnvelope<T>(response: Response, context: string): Promise<T> {
    if (!response.ok) {
      // Read the upstream body so the original CatWallet error (e.g. its
      // { code, message } envelope) shows up in our logs instead of just the
      // HTTP status. Guard the read in case the body is empty/unreadable.
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '<unreadable response body>';
      }
      this.logger.error(
        `${context} failed: ${response.status} ${response.statusText} - upstream body: ${body}`,
      );
      throw new BadGatewayException(`CatWallet API ${context} failed (${response.status})`);
    }
    const json = (await response.json()) as CatWalletEnvelope<T>;
    if (json?.code && json.code !== '200') {
      this.logger.error(`${context} error: ${json.code} - ${json.msg}`);
      throw new BadGatewayException(`CatWallet API error: ${json.msg || json.code}`);
    }
    return (json?.data ?? json) as T;
  }

  /** Fetch the full translation list (cached briefly in Redis). */
  async list(): Promise<I18nConfigItem[]> {
    const cached = await this.redis.get(LIST_CACHE_KEY);
    if (cached) return JSON.parse(cached) as I18nConfigItem[];

    const response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/list'), {
      method: 'POST',
      headers: { Accept: 'application/json', ...this.authHeaders() },
    });
    const data = (await this.parseEnvelope<I18nConfigItem[]>(response, 'list')) ?? [];
    await this.redis.set(LIST_CACHE_KEY, JSON.stringify(data), LIST_CACHE_TTL);
    return data;
  }

  /** Search translations by keyword (matches key or value). */
  async search(keyword: string): Promise<I18nConfigItem[]> {
    const response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/search'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({ keyword }),
    });
    return (await this.parseEnvelope<I18nConfigItem[]>(response, 'search')) ?? [];
  }

  /** Add a new key with its zh / en translations. */
  async add(configKey: string, zh: string, en: string) {
    const response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/add'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({ configKey, zh, en }),
    });
    const result = await this.parseEnvelope<unknown>(response, 'add');
    await this.invalidateCache();
    return result;
  }

  /** Update the value of an existing translation entry. */
  async update(configKey: string, id: string, value: string) {
    const response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({ configKey, id, value }),
    });
    const result = await this.parseEnvelope<unknown>(response, 'update');
    await this.invalidateCache();
    return result;
  }

  /** Forward an uploaded spreadsheet to the CatWallet batch-import endpoint. */
  async batchImport(file: { buffer: Buffer; originalname: string; mimetype: string }) {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname);

    const response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/batch/add'), {
      method: 'POST',
      headers: { Accept: 'application/json', ...this.authHeaders() },
      body: form,
    });
    const result = await this.parseEnvelope<unknown>(response, 'batch import');
    await this.invalidateCache();
    return result;
  }

  private async invalidateCache() {
    await this.redis.del(LIST_CACHE_KEY);
  }

  // ── Operation logs (local audit trail) ───────────────────────────────────────

  async writeOpLog(action: string, operator: string | null, key: string | null, detail?: unknown) {
    return this.prisma.i18nOpLog.create({
      data: {
        action,
        operator,
        key,
        detail: (detail as any) ?? undefined,
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
