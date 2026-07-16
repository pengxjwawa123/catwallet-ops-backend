import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

// Durable copy of the list — kept for a long time so we always have something
// to serve even when the slow upstream is unreachable (stale-while-revalidate).
const LIST_CACHE_KEY = 'i18n:config:list';
const LIST_CACHE_TTL = 24 * 60 * 60; // 24h
// Short-lived freshness marker. While it exists the cached copy is "fresh" and
// served directly; once it expires the cached copy is served as stale and a
// background revalidation is kicked off.
const LIST_FRESH_KEY = 'i18n:config:list:fresh';
const LIST_FRESH_TTL = 5 * 60; // 5min
// Upstream returns ~800KB and its latency swings wildly (observed 9–29s), so
// bound each call and retry once before giving up.
const UPSTREAM_TIMEOUT_MS = 25_000;
const UPSTREAM_RETRIES = 1;

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
   * fetch() bounded by an AbortController timeout, with a small number of
   * retries. The upstream i18n list is large and slow, so an unbounded fetch
   * can hang well past any client timeout; this caps each attempt.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = UPSTREAM_TIMEOUT_MS,
    retries = UPSTREAM_RETRIES,
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `upstream fetch attempt ${attempt + 1}/${retries + 1} failed for ${url}: ${
            (err as Error)?.message ?? err
          }`,
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
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

  /**
   * Fetch the full translation list.
   *
   * Uses stale-while-revalidate: the list is cached durably (24h). While the
   * short freshness marker (5min) is present the cached copy is returned
   * directly. Once it lapses, the cached copy is still returned immediately
   * (stale) and a background refresh is kicked off — so the slow upstream
   * (~800KB, 9–29s) never blocks a user request after the first warm-up.
   */
  async list(): Promise<I18nConfigItem[]> {
    const cached = await this.redis.get(LIST_CACHE_KEY);

    if (cached) {
      const data = JSON.parse(cached) as I18nConfigItem[];
      const fresh = await this.redis.get(LIST_FRESH_KEY);
      if (!fresh) {
        // Stale: serve now, refresh in the background (errors are swallowed —
        // the durable copy stays valid until the next successful refresh).
        void this.refreshList().catch((err) =>
          this.logger.warn(`background i18n refresh failed: ${(err as Error)?.message ?? err}`),
        );
      }
      return data;
    }

    // Cold cache: no choice but to wait for the upstream once.
    return this.refreshList();
  }

  /** Pull the list from upstream and update both cache keys. */
  private async refreshList(): Promise<I18nConfigItem[]> {
    const response = await this.fetchWithTimeout(
      this.buildUrl('/gt/wallet/api/i18n/config/list'),
      { method: 'POST', headers: { Accept: 'application/json', ...this.authHeaders() } },
    );
    const data = (await this.parseEnvelope<I18nConfigItem[]>(response, 'list')) ?? [];
    await this.redis.set(LIST_CACHE_KEY, JSON.stringify(data), LIST_CACHE_TTL);
    await this.redis.set(LIST_FRESH_KEY, '1', LIST_FRESH_TTL);
    return data;
  }

  /** Search translations by keyword (matches key or value). */
  async search(keyword: string): Promise<I18nConfigItem[]> {
    const response = await this.fetchWithTimeout(this.buildUrl('/gt/wallet/api/i18n/config/search'), {
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
    const response = await this.fetchWithTimeout(this.buildUrl('/gt/wallet/api/i18n/config/add'), {
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

  /** Update the zh / en translations of an existing entry by id. */
  async update(configKey: string, id: string, zh?: string, en?: string) {
    const response = await this.fetchWithTimeout(this.buildUrl('/gt/wallet/api/i18n/config/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({ configKey, id, zh, en }),
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

    const response = await this.fetchWithTimeout(this.buildUrl('/gt/wallet/api/i18n/config/batch/add'), {
      method: 'POST',
      headers: { Accept: 'application/json', ...this.authHeaders() },
      body: form,
    });
    const result = await this.parseEnvelope<unknown>(response, 'batch import');
    await this.invalidateCache();
    return result;
  }

  private async invalidateCache() {
    await this.redis.del(LIST_CACHE_KEY, LIST_FRESH_KEY);
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
