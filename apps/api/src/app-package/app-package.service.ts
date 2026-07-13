import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// App packages are large binaries; give uploads a generous timeout and no
// retries — a retried multipart upload could publish the same build twice.
const UPLOAD_APP_TIMEOUT_MS = 120_000;

interface CatWalletEnvelope<T> {
  code?: string;
  msg?: string;
  data?: T;
}

/** Minimal shape of a multer-parsed upload (avoids depending on @types/multer). */
export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Handles app-package (e.g. .apk) uploads by forwarding them to the CatWallet
 * upstream. Kept in its own module because publishing an app build is a
 * distinct concern from managing i18n translations, even though the upstream
 * groups the endpoint under its i18n/config path.
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

  /** Forward an uploaded app package to the CatWallet uploadApp endpoint. */
  async upload(file: UploadedFileLike) {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_APP_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(this.buildUrl('/gt/wallet/api/i18n/config/uploadApp'), {
        method: 'POST',
        headers: { Accept: 'application/json', ...this.authHeaders() },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.error(`app upload failed: ${(err as Error)?.message ?? err}`);
      throw new BadGatewayException('CatWallet API app upload failed');
    } finally {
      clearTimeout(timer);
    }
    return this.parseEnvelope<unknown>(response, 'app upload');
  }
}
