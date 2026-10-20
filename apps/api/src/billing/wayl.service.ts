import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';

export type WaylLinkStatus =
  | 'Created'
  | 'Pending'
  | 'Processing'
  | 'Complete'
  | 'Delivered'
  | 'Cancelled'
  | 'Rejected'
  | 'Returned';

export interface WaylCreateLinkInput {
  referenceId: string;
  total: number;
  currency?: string;
  customParameter?: string;
  lineItem?: Array<{
    label: string;
    amount: number;
    type: 'increase' | 'decrease';
  }>;
  webhookUrl?: string;
  webhookSecret?: string;
  redirectionUrl?: string;
  linkExpiresIn?: string;
}

export interface WaylLink {
  customParameter: string | null;
  referenceId: string;
  id: string;
  code: string;
  total: string;
  currency: string;
  type: string;
  paymentMethod: string | null;
  status: WaylLinkStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  webhookUrl: string;
  redirectionUrl: string;
  linkExpiresIn: string;
}

export interface WaylWebhookPayload {
  verb: string;
  event: string;
  referenceId: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentProcessor: string;
  total: number;
  commission: number;
  code: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    city: string;
    country: string;
    address: string;
  };
  items: Array<{
    type: string;
    label: string;
    amount: number;
  }>;
  id: string;
}

function stripEnvValue(value: string | undefined | null): string {
  return (value ?? '').replace(/^['"]+|['"]+$/g, '').trim();
}

function readEnvFromFiles(name: string): string {
  const files = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    '/root/whatsapp_GitHub/.env',
    '/root/whatsapp_GitHub/apps/api/.env',
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const match = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (!match) continue;
    const value = stripEnvValue(match[1]);
    if (value) return value;
  }
  return '';
}

function resolveEnv(config: ConfigService, name: string): string {
  const candidates = [
    stripEnvValue(process.env[name]),
    readEnvFromFiles(name),
    stripEnvValue(config.get<string>(name)),
  ];
  return candidates.find((value) => value && value !== 'not-configured') ?? '';
}

@Injectable()
export class WaylService {
  private readonly logger = new Logger(WaylService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private readonly env: 'live' | 'test';

  constructor(private readonly config: ConfigService) {
    this.apiKey = resolveEnv(config, 'WAYL_API_KEY');
    this.baseUrl = resolveEnv(config, 'WAYL_API_BASE_URL') || 'https://api.thewayl.com';
    this.webhookSecret = resolveEnv(config, 'WAYL_WEBHOOK_SECRET') || 'wayl-webhook-secret';
    this.env = resolveEnv(config, 'WAYL_ENV') === 'test' ? 'test' : 'live';
    this.logger.log(
      `Wayl ${this.isConfigured ? 'ready' : 'NOT configured'} keyLen=${this.apiKey.length} env=${this.env}`,
    );
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 20 && this.apiKey !== 'not-configured';
  }

  /**
   * Create a payment link on Wayl.
   * Returns the checkout URL to redirect the customer to.
   */
  async createLink(input: WaylCreateLinkInput): Promise<WaylLink> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Wayl payment gateway is not configured');
    }

    try {
      const { data } = await axios.post<{ data: WaylLink; message: string }>(
        `${this.baseUrl}/api/v1/links`,
        {
          env: this.env,
          referenceId: input.referenceId,
          total: input.total,
          currency: input.currency ?? 'IQD',
          customParameter: input.customParameter,
          lineItem: input.lineItem,
          webhookUrl: input.webhookUrl,
          webhookSecret: input.webhookSecret ?? this.webhookSecret,
          redirectionUrl: input.redirectionUrl,
          linkExpiresIn: input.linkExpiresIn ?? '24h',
        },
        {
          timeout: 12_000,
          headers: {
            'X-WAYL-AUTHENTICATION': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return data.data;
    } catch (err) {
      const ax = err as {
        code?: string;
        response?: { data?: unknown; status?: number };
        message?: string;
      };
      if (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message ?? '')) {
        this.logger.error('Wayl createLink timed out after 12s');
        throw new ServiceUnavailableException(
          'بوابة الدفع تأخرت في الرد. أعد المحاولة خلال لحظات.',
        );
      }
      const detail = ax.response?.data ? JSON.stringify(ax.response.data) : ax.message ?? String(err);
      this.logger.error(`Wayl createLink failed (${ax.response?.status ?? 'n/a'}): ${detail}`);
      throw new ServiceUnavailableException(`Wayl payment link creation failed: ${detail}`);
    }
  }

  /**
   * Retrieve a payment link by reference ID to check its status.
   */
  async getLink(referenceId: string): Promise<WaylLink> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Wayl payment gateway is not configured');
    }

    try {
      const { data } = await axios.get<{ data: WaylLink; message: string }>(
        `${this.baseUrl}/api/v1/links/${encodeURIComponent(referenceId)}`,
        {
          timeout: 10_000,
          headers: {
            'X-WAYL-AUTHENTICATION': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Wayl getLink failed: ${message}`);
      throw new ServiceUnavailableException(`Wayl link retrieval failed: ${message}`);
    }
  }

  /**
   * Invalidate a pending payment link (e.g. when checkout is abandoned).
   */
  async invalidateLink(referenceId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await axios.post(
        `${this.baseUrl}/api/v1/links/${encodeURIComponent(referenceId)}/invalidate-if-pending`,
        {},
        {
          headers: {
            'X-WAYL-AUTHENTICATION': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Wayl invalidateLink failed: ${message}`);
    }
  }

  /**
   * Verify the HMAC-SHA256 signature of a Wayl webhook payload.
   * Uses the raw body bytes exactly as received.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    try {
      const calculated = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const signatureBuffer = Buffer.from(signature, 'hex');
      const calculatedBuffer = Buffer.from(calculated, 'hex');

      if (signatureBuffer.length !== calculatedBuffer.length) return false;
      return timingSafeEqual(signatureBuffer, calculatedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parse and validate a webhook payload.
   */
  parseWebhookPayload(body: unknown): WaylWebhookPayload {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }
    const payload = body as Partial<WaylWebhookPayload> & { reference_id?: string };
    const referenceId = payload.referenceId || payload.reference_id;
    if (!referenceId) {
      throw new BadRequestException('Invalid webhook payload: missing referenceId');
    }
    return {
      verb: payload.verb ?? 'POST',
      event: payload.event ?? 'order.updated',
      referenceId,
      paymentMethod: payload.paymentMethod ?? '',
      paymentStatus: payload.paymentStatus ?? '',
      paymentProcessor: payload.paymentProcessor ?? '',
      total: Number(payload.total ?? 0),
      commission: Number(payload.commission ?? 0),
      code: payload.code ?? '',
      customer: payload.customer ?? { id: '', name: '', phone: '', city: '', country: '', address: '' },
      items: payload.items ?? [],
      id: payload.id ?? referenceId,
    };
  }
}