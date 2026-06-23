import {
  Injectable,
  NotImplementedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RedisService } from '../common/redis/redis.service';

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
  ) {
    this.apiBaseUrl = this.config.get<string>('CATWALLET_API_BASE_URL') || '';
    this.apiKey = this.config.get<string>('CATWALLET_API_KEY') || '';
    this.apiSecretKey = this.config.get<string>('CATWALLET_API_SECRET_KEY') || '';
  }

  async getConfig(language?: string) {
    const cacheKey = language ? `${CACHE_KEY}:${language}` : CACHE_KEY;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const url = `${this.apiBaseUrl}/gt/wallet/api/discover/i18n/config`;
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

  async findAll() {
    throw new NotImplementedException('i18n list not yet implemented');
  }

  async findOne(_id: string) {
    throw new NotImplementedException('i18n get not yet implemented');
  }

  async create(_dto: unknown) {
    throw new NotImplementedException('i18n create not yet implemented');
  }

  async update(_id: string, _dto: unknown) {
    throw new NotImplementedException('i18n update not yet implemented');
  }

  async remove(_id: string) {
    throw new NotImplementedException('i18n delete not yet implemented');
  }
}
