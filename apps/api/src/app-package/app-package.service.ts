import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Getting a presigned URL is a small, fast JSON call — unlike the old proxied
// binary upload it does not need a large timeout.
const UPSTREAM_TIMEOUT_MS = 25_000;

interface CatWalletEnvelope<T> {
  code?: string;
  msg?: string;
  data?: T;
}

/**
 * Handles app-package (e.g. .apk) publishing. Instead of proxying the binary
 * through our backend (which hit nginx/body-size limits), we ask the CatWallet
 * upstream for a presigned S3 URL and let the browser upload directly to S3.
 */
@Injectable()
export class AppPackageService {
  private readonly logger = new Logger(AppPackageService.name);
  private readonly apiBaseUrl: string;
  private readonly apiToken: string;

  constructor(private readonly config: ConfigService) {
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
    // Only attach Authorization when a token is configured; an empty `Bearer `
    // would make the upstream reject the request.
    return this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {};
  }

  /** Parse a CatWallet response, unwrapping the { code, msg, data } envelope. */
  private async parseEnvelope<T>(response: Response, context: string): Promise<T> {
    if (!response.ok) {
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
   * Fetch a presigned S3 upload URL from the CatWallet upstream. The upstream
   * endpoint takes no parameters; the browser then PUTs the file straight to
   * the returned URL, so the binary never passes through our backend.
   *
   * The upstream `data` shape is returned to the caller as-is (it carries the
   * presigned URL). We do not assume a specific field name here.
   */
  async getUploadUrl(): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      // All sibling CatWallet config endpoints (list/search/add/update) are
      // POST with Bearer auth; uploadUrl follows the same convention. Using GET
      // routes through the gateway's signature-required path and fails (1001).
      response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/uploadUrl'), {
        method: 'POST',
        headers: { Accept: 'application/json', ...this.authHeaders() },
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.error(`get upload url failed: ${(err as Error)?.message ?? err}`);
      throw new BadGatewayException('CatWallet API get upload url failed');
    } finally {
      clearTimeout(timer);
    }
    return this.parseEnvelope<unknown>(response, 'get upload url');
  }

  /**
   * Ask the CatWallet upstream to refresh its cache after a new app package has
   * been uploaded. Same gateway convention as uploadUrl: POST + Bearer (a GET
   * routes through the signature-required path and fails with 1001).
   */
  async refreshCache(): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/uploadCache'), {
        method: 'POST',
        headers: { Accept: 'application/json', ...this.authHeaders() },
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.error(`refresh cache failed: ${(err as Error)?.message ?? err}`);
      throw new BadGatewayException('CatWallet API refresh cache failed');
    } finally {
      clearTimeout(timer);
    }
    return this.parseEnvelope<unknown>(response, 'refresh cache');
  }
}
