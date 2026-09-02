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

@Injectable()
export class WaylService {
  private readonly logger = new Logger(WaylService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private readonly env: 'live' | 'test';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('WAYL_API_KEY') ?? 'not-configured';
    this.baseUrl = this.config.get<string>('WAYL_API_BASE_URL') ?? 'https://api.thewayl.com';
    this.webhookSecret = this.config.get<string>('WAYL_WEBHOOK_SECRET') ?? 'wayl-webhook-secret';
    this.env = (this.config.get<string>('WAYL_ENV') as 'live' | 'test') ?? 'test';
  }

  get isConfigured(): boolean {
    return this.apiKey !== 'not-configured' && this.apiKey.length > 0;
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
          headers: {
            'X-WAYL-AUTHENTICATION': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Wayl createLink failed: ${message}`);
      throw new ServiceUnavailableException(`Wayl payment link creation failed: ${message}`);
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
    const payload = body as Partial<WaylWebhookPayload>;
    if (!payload.referenceId || !payload.event || !payload.id) {
      throw new BadRequestException('Invalid webhook payload: missing required fields');
    }
    return payload as WaylWebhookPayload;
  }
}