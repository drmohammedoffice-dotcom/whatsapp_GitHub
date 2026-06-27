import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TIKTOK_API_BASE } from './tiktok.constants';

export type TikTokTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  advertiser_ids?: string[];
};

export type TikTokAdvertiserInfo = {
  advertiser_id: string;
  advertiser_name?: string;
  currency?: string;
  timezone?: string;
  status?: string;
};

@Injectable()
export class TikTokApiClient {
  private readonly logger = new Logger(TikTokApiClient.name);
  private readonly http: AxiosInstance;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('TIKTOK_CLIENT_KEY', '');
    this.appSecret = config.get<string>('TIKTOK_CLIENT_SECRET', '');
    this.http = axios.create({
      baseURL: TIKTOK_API_BASE,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  buildAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      state,
      redirect_uri: redirectUri,
    });
    return `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
  }

  async exchangeAuthCode(authCode: string): Promise<TikTokTokenResponse> {
    const { data } = await this.http.post('/oauth2/access_token/', {
      app_id: this.appId,
      secret: this.appSecret,
      auth_code: authCode,
    });
    this.assertOk(data, 'exchangeAuthCode');
    return data.data as TikTokTokenResponse;
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
    const { data } = await this.http.post('/oauth2/refresh_token/', {
      app_id: this.appId,
      secret: this.appSecret,
      refresh_token: refreshToken,
    });
    this.assertOk(data, 'refreshAccessToken');
    return data.data as TikTokTokenResponse;
  }

  async getAdvertisers(accessToken: string): Promise<TikTokAdvertiserInfo[]> {
    const { data } = await this.http.get('/oauth2/advertiser/get/', {
      params: { app_id: this.appId, secret: this.appSecret },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'getAdvertisers');
    const list = (data.data?.list ?? []) as Array<{ advertiser_id: string; advertiser_name?: string }>;
    return list.map((row) => ({
      advertiser_id: String(row.advertiser_id),
      advertiser_name: row.advertiser_name,
    }));
  }

  async getAdvertiserInfo(accessToken: string, advertiserIds: string[]): Promise<TikTokAdvertiserInfo[]> {
    if (!advertiserIds.length) return [];
    const { data } = await this.http.get('/advertiser/info/', {
      params: {
        advertiser_ids: JSON.stringify(advertiserIds),
        fields: JSON.stringify(['advertiser_id', 'name', 'currency', 'timezone', 'status']),
      },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'getAdvertiserInfo');
    const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
    return list.map((row) => ({
      advertiser_id: String(row.advertiser_id),
      advertiser_name: (row.name as string) ?? undefined,
      currency: (row.currency as string) ?? undefined,
      timezone: (row.timezone as string) ?? undefined,
      status: (row.status as string) ?? undefined,
    }));
  }

  async getBusinessCenters(accessToken: string, bcId?: string) {
    const params: Record<string, string> = { page: '1', page_size: '50' };
    if (bcId) params.bc_id = bcId;
    const { data } = await this.http.get('/bc/get/', {
      params,
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'getBusinessCenters');
    return (data.data?.list ?? []) as Array<Record<string, unknown>>;
  }

  /**
   * TikTok Events API (server-side). Requires pixel_code / event_source_id from TikTok Ads Manager.
   * Official docs: https://business-api.tiktok.com/portal/docs?id=1771100865818625
   */
  async sendEvent(
    accessToken: string,
    pixelCode: string,
    event: { event: string; event_id: string; timestamp: string; properties?: Record<string, unknown> },
  ) {
    const { data } = await this.http.post(
      '/event/track/',
      {
        pixel_code: pixelCode,
        event: event.event,
        event_id: event.event_id,
        timestamp: event.timestamp,
        properties: event.properties ?? {},
      },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'sendEvent');
    return data;
  }

  private assertOk(payload: { code?: number; message?: string }, action: string) {
    if (payload?.code !== 0 && payload?.code !== undefined) {
      this.logger.warn(`TikTok API ${action} failed: ${payload.message ?? 'unknown error'} (code ${payload.code})`);
      throw new Error(payload.message ?? `TikTok API error during ${action}`);
    }
  }
}
