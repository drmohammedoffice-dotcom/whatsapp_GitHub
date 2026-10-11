import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import { assertCampaignBodyMatchesRoute } from './tiktok-campaign-routes';

/** TikTok Marketing / Business API — separate from Login Kit (open.tiktokapis.com). */
export const TIKTOK_MARKETING_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
export const TIKTOK_MARKETING_AUTH_URL = 'https://business-api.tiktok.com/portal/auth';

export type TikTokBusinessAppCredentials = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};

export type TikTokMarketingTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  advertiser_ids?: Array<string | number>;
  scope?: string;
  open_id?: string;
};

export type TikTokAdsAdvertiser = {
  advertiser_id: string;
  advertiser_name?: string;
  currency?: string;
  timezone?: string;
  status?: string;
};

export type TikTokAdsBusinessCenter = {
  bc_id: string;
  name?: string;
  currency?: string;
  timezone?: string;
  raw: Record<string, unknown>;
};

/**
 * Marketing API client for Business Center and advertiser sync.
 * Future Lead Generation / campaign APIs should live here — not in Login Kit.
 */
@Injectable()
export class TikTokAdsService {
  private readonly logger = new Logger(TikTokAdsService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: TIKTOK_MARKETING_API_BASE,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Numeric app_id + secret from env — never use Login Kit client_key here. */
  resolveBusinessAppCredentials(): TikTokBusinessAppCredentials | null {
    const appId = this.config.get<string>('TIKTOK_BUSINESS_APP_ID', '')?.trim();
    const appSecret = this.config.get<string>('TIKTOK_BUSINESS_APP_SECRET', '')?.trim();
    if (!appId || !appSecret) {
      this.logger.warn(
        '[Marketing OAuth] TIKTOK_BUSINESS_APP_ID or TIKTOK_BUSINESS_APP_SECRET not configured',
      );
      return null;
    }
    if (!/^\d+$/.test(appId)) {
      this.logger.warn(
        `[Marketing OAuth] TIKTOK_BUSINESS_APP_ID must be numeric (got "${appId}"). Use App ID from TikTok Developer Portal, not Login Kit client_key.`,
      );
      return null;
    }
    const redirectUri = this.businessRedirectUri();
    return { appId, appSecret, redirectUri };
  }

  businessRedirectUri(): string {
    return (
      this.config.get<string>('TIKTOK_BUSINESS_REDIRECT_URI') ??
      `${this.config.getOrThrow<string>('API_PUBLIC_URL')}/api/auth/tiktok-business/callback`
    );
  }

  buildAuthorizeUrl(creds: TikTokBusinessAppCredentials, state: string): string {
    const params = new URLSearchParams({
      app_id: creds.appId,
      redirect_uri: creds.redirectUri,
      state,
    });
    const url = `${TIKTOK_MARKETING_AUTH_URL}?${params.toString()}`;
    this.logger.log(
      `[Marketing OAuth authorize URL] endpoint=${TIKTOK_MARKETING_AUTH_URL} app_id=${creds.appId} redirect_uri=${creds.redirectUri} state=${state} full_url=${url}`,
    );
    return url;
  }

  async exchangeAuthCode(
    creds: TikTokBusinessAppCredentials,
    authCode: string,
  ): Promise<TikTokMarketingTokenResponse> {
    this.logger.log(
      `[Marketing OAuth token REQUEST] POST ${TIKTOK_MARKETING_API_BASE}/oauth2/access_token/ app_id=${creds.appId} auth_code=${authCode}`,
    );
    try {
      const { data } = await this.http.post('/oauth2/access_token/', {
        app_id: creds.appId,
        secret: creds.appSecret,
        auth_code: authCode,
      });
      this.logger.log(
        `[Marketing OAuth token RESPONSE] ${JSON.stringify({ ...data, data: data?.data ? { ...data.data, access_token: '***', refresh_token: data.data?.refresh_token ? '***' : undefined } : undefined })}`,
      );
      this.assertOk(data, 'exchangeAuthCode');
      const tokenData = (data.data ?? data) as TikTokMarketingTokenResponse;
      if (!tokenData.access_token) {
        throw new Error('TikTok Marketing OAuth response missing access_token');
      }
      return tokenData;
    } catch (err) {
      this.logApiError('exchangeAuthCode', err);
      throw err;
    }
  }

  async refreshMarketingAccessToken(
    creds: TikTokBusinessAppCredentials,
    refreshToken: string,
  ): Promise<TikTokMarketingTokenResponse> {
    this.logger.log(`[Marketing OAuth refresh REQUEST] app_id=${creds.appId}`);
    try {
      const { data } = await this.http.post('/oauth2/refresh_token/', {
        app_id: creds.appId,
        secret: creds.appSecret,
        refresh_token: refreshToken,
      });
      this.logger.log(
        `[Marketing OAuth refresh RESPONSE] ${JSON.stringify({ code: data?.code, message: data?.message })}`,
      );
      this.assertOk(data, 'refreshMarketingAccessToken');
      const tokenData = (data.data ?? data) as TikTokMarketingTokenResponse;
      if (!tokenData.access_token) {
        throw new Error('TikTok Marketing refresh response missing access_token');
      }
      return tokenData;
    } catch (err) {
      this.logApiError('refreshMarketingAccessToken', err);
      throw err;
    }
  }

  isConfigured(): boolean {
    return this.resolveBusinessAppCredentials() !== null;
  }

  async getAuthorizedAdvertisers(
    creds: TikTokBusinessAppCredentials,
    accessToken: string,
  ): Promise<TikTokAdsAdvertiser[]> {
    this.logger.log(`[Marketing API] GET /oauth2/advertiser/get/ app_id=${creds.appId}`);
    try {
      const { data } = await this.http.get('/oauth2/advertiser/get/', {
        params: { app_id: creds.appId, secret: creds.appSecret },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'getAuthorizedAdvertisers');
      const list = (data.data?.list ?? []) as Array<{
        advertiser_id: string | number;
        advertiser_name?: string;
      }>;
      return list.map((row) => ({
        advertiser_id: String(row.advertiser_id),
        advertiser_name: row.advertiser_name,
      }));
    } catch (err) {
      this.logApiError('getAuthorizedAdvertisers', err);
      throw err;
    }
  }

  async getAdvertiserDetails(
    accessToken: string,
    advertiserIds: string[],
  ): Promise<TikTokAdsAdvertiser[]> {
    if (!advertiserIds.length) return [];
    this.logger.log(`[Marketing API] GET /advertiser/info/ ids=${advertiserIds.join(',')}`);
    try {
      const { data } = await this.http.get('/advertiser/info/', {
        params: {
          advertiser_ids: JSON.stringify(advertiserIds),
          fields: JSON.stringify(['advertiser_id', 'name', 'currency', 'timezone', 'status']),
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'getAdvertiserDetails');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      return list.map((row) => ({
        advertiser_id: String(row.advertiser_id),
        advertiser_name: (row.name as string) ?? undefined,
        currency: (row.currency as string) ?? undefined,
        timezone: (row.timezone as string) ?? undefined,
        status: (row.status as string) ?? undefined,
      }));
    } catch (err) {
      this.logApiError('getAdvertiserDetails', err);
      throw err;
    }
  }

  async getBusinessCenters(accessToken: string): Promise<TikTokAdsBusinessCenter[]> {
    this.logger.log('[Marketing API] GET /bc/get/');
    try {
      const { data } = await this.http.get('/bc/get/', {
        params: { page: '1', page_size: '50' },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'getBusinessCenters');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      const centers: TikTokAdsBusinessCenter[] = [];
      for (const row of list) {
        const info = (row.bc_info && typeof row.bc_info === 'object' ? row.bc_info : row) as Record<string, unknown>;
        const bcId = String(info.bc_id ?? row.bc_id ?? row.id ?? '');
        if (!bcId) continue;
        centers.push({
          bc_id: bcId,
          name: String(info.name ?? row.name ?? '') || undefined,
          currency: String(info.currency ?? row.currency ?? '') || undefined,
          timezone: String(info.timezone ?? row.timezone ?? '') || undefined,
          raw: row,
        });
      }
      return centers;
    } catch (err) {
      this.logApiError('getBusinessCenters', err);
      throw err;
    }
  }

  private assertOk(payload: { code?: number; message?: string }, action: string) {
    if (payload?.code !== 0 && payload?.code !== undefined) {
      const msg = payload.message ?? `TikTok Marketing API error during ${action}`;
      this.logger.warn(`[Marketing API] ${action} failed: ${msg} (code ${payload.code})`);
      throw new Error(msg);
    }
  }

  private logApiError(action: string, err: unknown) {
    if (err instanceof AxiosError && err.response) {
      this.logger.error(
        `[Marketing API] ${action} HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`,
      );
    } else if (err instanceof Error) {
      this.logger.error(`[Marketing API] ${action}: ${err.message}`);
    }
  }

  /** TikTok throttles concurrent entity creates/updates under the same advertiser. */
  private isConcurrentEntityError(err: unknown): boolean {
    const msg = err instanceof Error
      ? err.message
      : err instanceof AxiosError
        ? String(err.response?.data?.message ?? err.message ?? '')
        : String(err ?? '');
    return /too many concurrent requests of updating entities|concurrent requests.*updating entities|rate limit|too many requests|try again later/i.test(msg);
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  async withEntityUpdateRetry<T>(action: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this.isConcurrentEntityError(err) || attempt >= attempts) throw err;
        const delayMs = Math.min(12_000, 1500 * (2 ** (attempt - 1)));
        this.logger.warn(
          `[Marketing API] ${action} concurrent/rate-limit (attempt ${attempt}/${attempts}); retry in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async listPixels(accessToken: string, advertiserId: string) {
    this.logger.log(`[Marketing API] GET /pixel/list/ advertiser=${advertiserId}`);
    try {
      const pageSize = 20;
      const all: Array<{
        pixel_id: string;
        pixel_code: string;
        pixel_name?: string;
        activity_status: unknown;
        raw: Record<string, unknown>;
      }> = [];
      for (let page = 1; page <= 50; page++) {
        const { data } = await this.http.get('/pixel/list/', {
          params: {
            advertiser_id: advertiserId,
            page: String(page),
            page_size: String(pageSize),
          },
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'listPixels');
        const list = (data.data?.pixels ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
        all.push(
          ...list.map((row) => ({
            pixel_id: String(row.pixel_id ?? row.id ?? ''),
            pixel_code: String(row.pixel_code ?? row.pixel_id ?? ''),
            pixel_name: (row.pixel_name as string) ?? undefined,
            activity_status: row.activity_status ?? row.status ?? row.pixel_status,
            raw: row,
          })),
        );
        if (list.length < pageSize) break;
      }
      return all;
    } catch (err) {
      this.logApiError('listPixels', err);
      throw err;
    }
  }

  async createPixel(accessToken: string, advertiserId: string, pixelName: string) {
    this.logger.log(`[Marketing API] POST /pixel/create/ advertiser=${advertiserId} name=${pixelName}`);
    const isDuplicateName = (err: unknown) =>
      err instanceof Error && /duplicated pixel name/i.test(err.message);

    for (let attempt = 0; attempt < 5; attempt++) {
      const name =
        attempt === 0
          ? pixelName
          : `${pixelName.slice(0, 90)} ${Date.now().toString(36)}`.slice(0, 100);
      try {
        const { data } = await this.http.post(
          '/pixel/create/',
          {
            advertiser_id: advertiserId,
            pixel_name: name,
            pixel_category: 'LANDING_PAGE',
          },
          { headers: { 'Access-Token': accessToken } },
        );
        this.assertOk(data, 'createPixel');
        const row = (data.data ?? {}) as Record<string, unknown>;
        const pixelId = String(row.pixel_id ?? row.id ?? '');
        let pixelCode = String(row.pixel_code ?? row.code ?? '');
        pixelCode = await this.ensurePixelCode(accessToken, advertiserId, pixelId, pixelCode);
        return {
          pixel_id: pixelId,
          pixel_code: pixelCode,
          pixel_name: (row.pixel_name as string) ?? name,
        };
      } catch (err) {
        if (attempt < 4 && isDuplicateName(err)) {
          this.logger.warn(`[Marketing API] createPixel duplicate name, retrying (${attempt + 1})`);
          continue;
        }
        this.logApiError('createPixel', err);
        throw err;
      }
    }
    throw new Error('Failed to create pixel after retries');
  }

  /** Events API + browser SDK require the alphanumeric pixel code — not the numeric pixel_id. */
  async ensurePixelCode(
    accessToken: string,
    advertiserId: string,
    pixelId: string,
    pixelCode: string,
  ): Promise<string> {
    if (pixelCode && !/^\d+$/.test(pixelCode)) return pixelCode;
    const pixels = await this.listPixels(accessToken, advertiserId);
    const match = pixels.find((p) => p.pixel_id === pixelId);
    if (match?.pixel_code && !/^\d+$/.test(match.pixel_code)) {
      return match.pixel_code;
    }
    const raw = match?.raw ?? {};
    for (const key of ['pixel_code', 'code', 'pixelCode']) {
      const val = String((raw as Record<string, unknown>)[key] ?? '');
      if (val && !/^\d+$/.test(val)) return val;
    }
    return pixelCode || pixelId;
  }

  async trackPixelEvent(
    accessToken: string,
    pixelCode: string,
    input: {
      event: string;
      event_id: string;
      event_time: number;
      url?: string;
      ttclid?: string | null;
      ip?: string | null;
      userAgent?: string | null;
      /** SHA-256 hex of E.164 digits (no +). */
      phone?: string | null;
      externalId?: string | null;
      properties?: Record<string, string | undefined>;
      /**
       * Extra Events API events in the same request (same user/ttclid).
       * Used so Lead Gen Ads campaigns receive Lead when WhatsApp fires Contact.
       */
      companionEvents?: Array<{ event: string; event_id: string }>;
    },
  ) {
    const user: Record<string, string> = {};
    if (input.ttclid) user.ttclid = input.ttclid;
    if (input.ip) user.ip = input.ip;
    if (input.userAgent) user.user_agent = input.userAgent;
    if (input.phone) user.phone = input.phone;
    if (input.externalId) user.external_id = input.externalId;

    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.properties ?? {})) {
      if (value !== undefined && value !== null) properties[key] = value;
    }

    const page = input.url ? { url: input.url } : undefined;
    const props = Object.keys(properties).length > 0 ? properties : undefined;

    const data = [
      {
        event: input.event,
        event_time: input.event_time,
        event_id: input.event_id,
        user,
        page,
        properties: props,
      },
      ...(input.companionEvents ?? [])
        .filter((c) => c.event && c.event_id && c.event !== input.event)
        .map((c) => ({
          event: c.event,
          event_time: input.event_time,
          event_id: c.event_id,
          user,
          page,
          properties: props,
        })),
    ];

    // Events API 2.0 payload — the flat pixel_code format is rejected silently
    // by TikTok, which leaves the pixel stuck in "Waiting for activity".
    const payload = {
      event_source: 'web',
      event_source_id: pixelCode,
      data,
    };
    this.logger.log(
      `[Marketing API] POST /event/track/ pixel=${pixelCode} events=${data
        .map((e) => e.event)
        .join('+')} ttclid=${input.ttclid ? 'yes' : 'no'}`,
    );
    try {
      const { data: response } = await this.http.post('/event/track/', payload, {
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(response, 'trackPixelEvent');
      return response;
    } catch (err) {
      this.logApiError('trackPixelEvent', err);
      if (err instanceof AxiosError && err.response?.data) {
        const body = err.response.data as { message?: string; code?: number };
        if (body.message) {
          throw new Error(
            body.code != null ? `${body.message} (code ${body.code})` : body.message,
          );
        }
      }
      throw err;
    }
  }

  /** Register standard events in TikTok Events Manager (best-effort). */
  async registerPixelEvents(
    accessToken: string,
    advertiserId: string,
    pixelId: string,
    eventNames: string[],
  ) {
    // TikTok يرفض أكثر من حدث بنفس event_type في نفس الطلب (مثلاً Lead+SubmitForm → FORM).
    // نسجّل حدثاً واحداً لكل نوع، مع أولوية أهداف التحسين المهمة.
    const priority = [
      'CompletePayment',
      'Purchase',
      'Lead',
      'Contact',
      'SubmitForm',
      'InitiateCheckout',
      'AddToCart',
      'CompleteRegistration',
      'ViewContent',
    ];
    const uniqueNames = [...new Set(
      eventNames.map((name) => name?.trim()).filter((name): name is string => Boolean(name) && name !== 'PageView'),
    )];
    uniqueNames.sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const byType = new Map<string, { event_type: string; event_name: string; statistic_type: 'EVERY_TIME' }>();
    for (const event_name of uniqueNames) {
      const event_type = this.toPixelEventType(event_name);
      if (byType.has(event_type)) continue;
      byType.set(event_type, {
        event_type,
        event_name,
        statistic_type: 'EVERY_TIME',
      });
    }
    const pixel_events = [...byType.values()];
    if (!pixel_events.length) return;

    // سجّل واحداً واحداً حتى لا يفشل الطلب كله عند وجود حدث مسجّل مسبقاً
    for (const pixel_event of pixel_events) {
    this.logger.log(
        `[Marketing API] POST /pixel/event/create/ pixel=${pixelId} events=${pixel_event.event_name}:${pixel_event.event_type}`,
    );
    try {
      const { data } = await this.http.post(
        '/pixel/event/create/',
          { advertiser_id: advertiserId, pixel_id: pixelId, pixel_events: [pixel_event] },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'registerPixelEvents');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // الحدث موجود مسبقاً = نجاح عملي
        if (/duplicat/i.test(msg) || /already/i.test(msg) || /40002/.test(msg)) {
          this.logger.log(`[Marketing API] registerPixelEvents skip existing ${pixel_event.event_name}: ${msg}`);
          continue;
        }
      this.logApiError('registerPixelEvents', err);
        this.logger.warn(`[Marketing API] registerPixelEvents soft-fail ${pixel_event.event_name}: ${msg}`);
      }
    }
  }

  async listTargetingRegions(accessToken: string, advertiserId: string, objectiveType: string) {
    const { data } = await this.http.get('/tool/region/', {
      params: {
        advertiser_id: advertiserId,
        placements: JSON.stringify(['PLACEMENT_TIKTOK']),
        objective_type: objectiveType,
        level_range: 'TO_COUNTRY',
        language: 'ar',
      },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'listTargetingRegions');
    const list = (data.data?.region_info ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
    return list
      .map((row) => ({
        locationId: String(row.location_id ?? row.id ?? ''),
        name: String(row.name ?? ''),
        regionCode: String(row.region_code ?? ''),
        level: String(row.level ?? ''),
      }))
      .filter((row) => row.locationId && row.name);
  }

  async listInterestCategories(accessToken: string, advertiserId: string) {
    const { data } = await this.http.get('/tool/interest_category/', {
      params: { advertiser_id: advertiserId, version: '2', language: 'ar' },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'listInterestCategories');
    const list = (data.data?.interest_categories ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
    return list
      .map((row) => ({
        id: String(row.interest_category_id ?? row.id ?? ''),
        name: String(row.interest_category_name ?? row.name ?? ''),
      }))
      .filter((row) => row.id && row.name);
  }

  async listIdentities(accessToken: string, advertiserId: string) {
    const owner = await this.resolveAdvertiserBusinessCenter(accessToken, advertiserId).catch(() => null);
    const centers = await this.getBusinessCenters(accessToken).catch(() => []);
    const bcIds = [...new Set([owner?.bc_id, ...centers.map((center) => center.bc_id)].filter((id): id is string => Boolean(id)))];
    // بدون identity_type تُرجع تيك توك كل الهويات المرتبطة بالحساب الإعلاني
    const groups = await Promise.all([
      this.identityPages(accessToken, advertiserId),
      this.identityPages(accessToken, advertiserId, 'TT_USER'),
      this.identityPages(accessToken, advertiserId, 'CUSTOMIZED_USER'),
      ...bcIds.map((bcId) => this.identityPages(accessToken, advertiserId, 'BC_AUTH_TT', bcId)),
    ]);
    const seen = new Set<string>();
    const identities = [];
    for (const identity of groups.flat()) {
      const key = `${identity.identityType}:${identity.identityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      identities.push(identity);
    }
    if (!identities.length) {
      this.logger.warn(`[listIdentities] empty for advertiser=${advertiserId} bcIds=${bcIds.join(',') || 'none'}`);
    }
    return identities;
  }

  private async identityPages(accessToken: string, advertiserId: string, identityType?: string, businessCenterId?: string) {
    const identities: Array<{ identityId: string; identityType: string; displayName: string; imageUrl: string | null; identityAuthorizedBcId: string }> = [];
    for (let page = 1; page <= 5; page += 1) {
      const params: Record<string, string> = {
        advertiser_id: advertiserId,
        page: String(page),
        page_size: '100',
      };
      if (identityType) params.identity_type = identityType;
      if (businessCenterId) params.identity_authorized_bc_id = businessCenterId;
      let list: Array<Record<string, unknown>> = [];
      try {
        const { data } = await this.http.get('/identity/get/', {
          params,
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'listIdentities');
        list = (data.data?.identity_list ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
      } catch (err) {
        this.logApiError('listIdentities', err);
        break;
      }
      for (const row of list) {
        const status = String(row.available_status ?? row.status ?? 'AVAILABLE').toUpperCase();
        if (status === 'NOT_AVAILABLE' || status === 'UNAVAILABLE' || status === 'DELETE') continue;
        const authorizedBc = String(row.identity_authorized_bc_id ?? '');
        if (identityType === 'BC_AUTH_TT' && businessCenterId && authorizedBc && authorizedBc !== businessCenterId) continue;
        const identityId = String(row.identity_id ?? '');
        const type = String(row.identity_type ?? identityType ?? '');
        if (!identityId || !type || type === 'AUTH_CODE') continue;
        identities.push({
          identityId,
          identityType: type,
          displayName: String(row.display_name ?? row.username ?? identityId),
          imageUrl: identityImage(row),
          identityAuthorizedBcId: type === 'BC_AUTH_TT' ? authorizedBc || businessCenterId || '' : '',
        });
      }
      if (list.length < 100) break;
    }
    return identities;
  }

  async listIdentityVideos(
    accessToken: string,
    advertiserId: string,
    identityId: string,
    identityType: string,
    cursor?: string,
  ) {
    const params: Record<string, string> = {
      advertiser_id: advertiserId,
      identity_id: identityId,
      identity_type: identityType,
      count: '20',
    };
    if (cursor) params.cursor = cursor;
    let authorizedBc = '';
    if (identityType === 'BC_AUTH_TT') {
      const identities = await this.listIdentities(accessToken, advertiserId).catch(() => []);
      authorizedBc = identities.find((row) => row.identityId === identityId && row.identityType === 'BC_AUTH_TT')?.identityAuthorizedBcId || '';
      if (!authorizedBc) {
        const center = await this.resolveAdvertiserBusinessCenter(accessToken, advertiserId).catch(() => null);
        authorizedBc = center?.bc_id ?? '';
      }
      if (authorizedBc) params.identity_authorized_bc_id = authorizedBc;
    }
    const { data } = await this.http.get('/identity/video/get/', {
      params,
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'listIdentityVideos');
    const payload = (data.data ?? {}) as Record<string, unknown>;
    const list = (payload.video_list ?? payload.list ?? []) as Array<Record<string, unknown>>;
    const videos = list
      .map((row) => {
        const media = readTikTokMedia(row);
        return {
          itemId: media.itemId,
          text: media.text,
          posterUrl: media.posterUrl,
          videoUrl: media.videoUrl,
          identityId: media.identityId || identityId,
          identityType: media.identityType || identityType,
          identityAuthorizedBcId: authorizedBc,
        };
      })
      .filter((row) => row.itemId);
    const nextCursor = typeof payload.cursor === 'string' ? payload.cursor : payload.cursor != null ? String(payload.cursor) : '';
    return { videos, nextCursor, hasMore: Boolean(payload.has_more) && Boolean(nextCursor) };
  }

  async getAdvertiserProfile(accessToken: string, advertiserId: string) {
    const { data } = await this.http.get('/advertiser/info/', {
      params: { advertiser_ids: JSON.stringify([advertiserId]) },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'advertiserInfo');
    const row = ((data.data?.list ?? [])[0] ?? {}) as Record<string, unknown>;
    const taxRaw = Number(row.tax_rate ?? row.vat_rate ?? 0);
    return {
      advertiserId,
      name: String(row.name ?? row.advertiser_name ?? '') || null,
      currency: String(row.currency ?? '') || null,
      timezone: String(row.timezone ?? '') || null,
      country: String(row.country ?? '') || null,
      taxRate: Number.isFinite(taxRaw) && taxRaw > 0 ? taxRaw : 0,
      ownerBcId: String(row.owner_bc_id ?? '') || null,
    };
  }

  async resolveAdvertiserBusinessCenter(accessToken: string, advertiserId: string) {
    const ownerBcId = await this.advertiserOwnerBcId(accessToken, advertiserId).catch(() => null);
    const centers = await this.getBusinessCenters(accessToken).catch(() => [] as TikTokAdsBusinessCenter[]);
    if (ownerBcId) {
      return centers.find((center) => center.bc_id === ownerBcId) ?? { bc_id: ownerBcId, name: undefined, raw: {} };
    }
    if (centers.length === 1) return centers[0];
    for (const center of centers) {
      const owns = await this.businessCenterOwnsAdvertiser(accessToken, center.bc_id, advertiserId).catch(() => false);
      if (owns) return center;
    }
    return null;
  }

  private async advertiserOwnerBcId(accessToken: string, advertiserId: string) {
    const { data } = await this.http.get('/advertiser/info/', {
      params: {
        advertiser_ids: JSON.stringify([advertiserId]),
        fields: JSON.stringify(['advertiser_id', 'owner_bc_id']),
      },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'advertiserOwnerBc');
    const row = ((data.data?.list ?? [])[0] ?? {}) as Record<string, unknown>;
    return String(row.owner_bc_id ?? '') || null;
  }

  private async businessCenterOwnsAdvertiser(accessToken: string, bcId: string, advertiserId: string) {
    const { data } = await this.http.get('/bc/asset/get/', {
      params: { bc_id: bcId, asset_type: 'ADVERTISER', page: 1, page_size: 50 },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'bcAssets');
    const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
    return list.some((row) => String(row.asset_id ?? row.advertiser_id ?? '') === advertiserId);
  }

  async getAdvertiserBalance(accessToken: string, advertiserId: string) {
    const { data } = await this.http.get('/advertiser/balance/get/', {
      params: { advertiser_ids: JSON.stringify([advertiserId]) },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'advertiserBalance');
    const row = ((data.data?.list ?? [])[0] ?? {}) as Record<string, unknown>;
    const balance = Number(row.account_balance ?? row.cash_balance ?? row.balance ?? 0);
    return {
      balance: Number.isFinite(balance) ? balance : 0,
      currency: String(row.currency ?? '') || null,
    };
  }

  async listCampaignNames(accessToken: string, advertiserId: string) {
    const names: string[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/campaign/get/', {
        params: { advertiser_id: advertiserId, page, page_size: 100 },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listCampaigns');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      for (const row of list) names.push(String(row.campaign_name ?? ''));
      if (list.length < 100) break;
    }
    return names;
  }

  async listCampaignRows(accessToken: string, advertiserId: string) {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/campaign/get/', {
        params: { advertiser_id: advertiserId, page, page_size: 100 },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listCampaigns');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      rows.push(...list);
      if (list.length < 100) break;
    }
    return rows;
  }

  async listAdGroupRows(accessToken: string, advertiserId: string) {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/adgroup/get/', {
        params: { advertiser_id: advertiserId, page, page_size: 100 },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listAdGroups');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      rows.push(...list);
      if (list.length < 100) break;
    }
    return rows;
  }

  async listForCampaign(
    accessToken: string,
    path: '/campaign/get/' | '/adgroup/get/' | '/ad/get/',
    advertiserId: string,
    campaignId: string,
    fields?: string[],
  ) {
    const params: Record<string, string> = {
      advertiser_id: advertiserId,
      page: '1',
      page_size: '100',
      filtering: JSON.stringify({ campaign_ids: [campaignId] }),
    };
    if (fields?.length) params.fields = JSON.stringify(fields);
    const { data } = await this.http.get(path, {
      params,
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, path);
    return (data.data?.list ?? []) as Array<Record<string, unknown>>;
  }

  async campaignReport(accessToken: string, advertiserId: string, startDate: string, endDate: string) {
    const { data } = await this.http.get('/report/integrated/get/', {
      params: {
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        data_level: 'AUCTION_CAMPAIGN',
        dimensions: JSON.stringify(['campaign_id']),
        metrics: JSON.stringify([
          'spend',
          'impressions',
          'reach',
          'clicks',
          'conversion',
          'cost_per_conversion',
          'conversion_rate',
        ]),
        start_date: startDate,
        end_date: endDate,
        page_size: 200,
      },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'campaignReport');
    return (data.data?.list ?? []) as Array<Record<string, unknown>>;
  }

  async adReport(accessToken: string, advertiserId: string, startDate: string, endDate: string) {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/report/integrated/get/', {
        params: {
          advertiser_id: advertiserId,
          report_type: 'BASIC',
          data_level: 'AUCTION_AD',
          dimensions: JSON.stringify(['ad_id']),
          metrics: JSON.stringify([
            'spend',
            'impressions',
            'reach',
            'clicks',
            'conversion',
            'cost_per_conversion',
            'conversion_rate',
          ]),
          start_date: startDate,
          end_date: endDate,
          page,
          page_size: 200,
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'adReport');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      rows.push(...list);
      if (list.length < 200) break;
    }
    return rows;
  }

  async updateAdGroupBudget(accessToken: string, advertiserId: string, adGroupId: string, budget: number) {
    const { data } = await this.http.post(
      '/adgroup/update/',
      { advertiser_id: advertiserId, adgroup_id: adGroupId, budget },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'updateAdGroupBudget');
  }

  async rechargeAdvertiser(accessToken: string, bcId: string, advertiserId: string, amount: number, requestId?: string) {
    const { data } = await this.http.post(
      '/bc/transfer/',
      {
        bc_id: bcId,
        advertiser_id: advertiserId,
        transfer_type: 'RECHARGE',
        cash_amount: amount,
        ...(requestId ? { request_id: requestId } : {}),
      },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'rechargeAdvertiser');
    return data.data ?? {};
  }

  async previewSparkCode(accessToken: string, advertiserId: string, authCode: string) {
    const code = authCode.trim();
    const { data: authorized } = await this.http.post(
      '/tt_video/authorize/',
      { advertiser_id: advertiserId, auth_code: code },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(authorized, 'authorizeSparkCode');
    const { data } = await this.http.get('/tt_video/info/', {
      params: { advertiser_id: advertiserId, auth_code: code },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'sparkVideoInfo');
    const info = (data.data ?? {}) as Record<string, unknown>;
    const item = (info.item_info ?? {}) as Record<string, unknown>;
    const user = (info.user_info ?? {}) as Record<string, unknown>;
    const video = (info.video_info ?? item.video_info ?? {}) as Record<string, unknown>;
    const itemId = String(item.item_id ?? info.item_id ?? '');
    if (!itemId) throw new Error('TikTok did not return a video for this ad code');
    const media = readTikTokMedia({ ...item, ...info, video_info: video, identity_id: user.identity_id, identity_type: user.identity_type });
    const identityId = String(user.identity_id ?? media.identityId ?? '');
    const rawType = String(user.identity_type ?? media.identityType ?? '');
    const returnedBc = String(user.identity_authorized_bc_id ?? user.identity_bc_id ?? info.identity_authorized_bc_id ?? '');
    const identityType = rawType || (returnedBc ? 'BC_AUTH_TT' : 'AUTH_CODE');
    let identityAuthorizedBcId = identityType === 'BC_AUTH_TT' ? returnedBc : '';
    if (identityType === 'BC_AUTH_TT' && !identityAuthorizedBcId && identityId) {
      const identities = await this.listIdentities(accessToken, advertiserId).catch(() => []);
      identityAuthorizedBcId = identities.find((row) => row.identityId === identityId && row.identityType === 'BC_AUTH_TT')?.identityAuthorizedBcId || '';
      if (!identityAuthorizedBcId) {
        const center = await this.resolveAdvertiserBusinessCenter(accessToken, advertiserId).catch(() => null);
        identityAuthorizedBcId = center?.bc_id ?? '';
      }
    }
    let posterUrl = media.posterUrl;
    let videoUrl = media.videoUrl;
    let previewLink = '';
    if (!posterUrl && itemId) posterUrl = await this.publicItemCover(itemId).catch(() => '');
    if (!posterUrl && !videoUrl && itemId && identityId) {
      const preview = await this.materialPreview(accessToken, advertiserId, {
        preview_type: 'ADS_CREATION',
        ad_format: 'SINGLE_VIDEO',
        identity_id: identityId,
        identity_type: identityType,
        tiktok_item_id: itemId,
        ...(identityAuthorizedBcId ? { identity_authorized_bc_id: identityAuthorizedBcId } : {}),
      }).catch(() => null);
      previewLink = preview?.previewLink ?? '';
    }
    if (!posterUrl && !videoUrl && !previewLink && itemId) {
      previewLink = `https://www.tiktok.com/embed/v2/${itemId}`;
    }
    return {
      authCode: code,
      itemId,
      text: media.text || String(item.text ?? ''),
      posterUrl,
      videoUrl,
      previewLink,
      identityId,
      identityType,
      identityAuthorizedBcId,
      displayName: String(user.display_name ?? user.tiktok_name ?? ''),
    };
  }

  async listAdRows(accessToken: string, advertiserId: string) {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/ad/get/', {
        params: {
          advertiser_id: advertiserId,
          page,
          page_size: 100,
          fields: JSON.stringify([
            'ad_id',
            'ad_name',
            'ad_text',
            'campaign_id',
            'adgroup_id',
            'video_id',
            'tiktok_item_id',
            'identity_id',
            'identity_type',
            'image_ids',
            'ad_format',
            'operation_status',
            'call_to_action',
            'landing_page_url',
          ]),
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listAds');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      rows.push(...list);
      if (list.length < 100) break;
    }
    return rows;
  }

  /** إعلانات Smart+ — /ad/get/ لا يعيدها دائماً */
  async listSmartPlusAdRows(accessToken: string, advertiserId: string) {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 5; page += 1) {
      try {
        const { data } = await this.http.get('/smart_plus/ad/get/', {
          params: {
            advertiser_id: advertiserId,
            page,
            page_size: 100,
          },
          headers: { 'Access-Token': accessToken },
        });
        if (Number(data?.code) !== 0) break;
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        for (const row of list) {
          const adId = String(row.smart_plus_ad_id ?? row.ad_id ?? '');
          if (!adId) continue;
          rows.push({
            ...row,
            ad_id: adId,
            ad_name: String(row.ad_name ?? row.smart_plus_ad_name ?? row.ad_text ?? ''),
            campaign_id: String(row.campaign_id ?? ''),
            adgroup_id: String(row.adgroup_id ?? row.smart_plus_adgroup_id ?? ''),
            operation_status: String(row.operation_status ?? 'ENABLE'),
          });
        }
        if (list.length < 100) break;
      } catch {
        break;
      }
    }
    return rows;
  }

  async identityVideoInfo(
    accessToken: string,
    advertiserId: string,
    identityId: string,
    identityType: string,
    itemIds: string[],
    businessCenterId?: string,
  ) {
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (!identityId || !identityType || !ids.length) return [] as Array<Record<string, unknown>>;
    let bcId = businessCenterId ?? '';
    if (!bcId && identityType === 'BC_AUTH_TT') {
      const center = await this.resolveAdvertiserBusinessCenter(accessToken, advertiserId).catch(() => null);
      bcId = center?.bc_id ?? '';
    }
    const rows: Array<Record<string, unknown>> = [];
    const fetchChunk = async (chunk: string[]) => {
      const params: Record<string, string> = {
        advertiser_id: advertiserId,
        identity_id: identityId,
        identity_type: identityType,
        item_ids: JSON.stringify(chunk),
      };
      if (bcId) params.identity_authorized_bc_id = bcId;
      const { data } = await this.http.get('/identity/video/info/', {
        params,
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'identityVideoInfo');
      return videoRowsFromPayload((data.data ?? {}) as Record<string, unknown>);
    };
    for (let offset = 0; offset < ids.length; offset += 20) {
      const chunk = ids.slice(offset, offset + 20);
      try {
        rows.push(...(await fetchChunk(chunk)));
      } catch (err) {
        this.logApiError('identityVideoInfo', err);
        if (chunk.length === 1) continue;
        for (const itemId of chunk) {
          try {
            rows.push(...(await fetchChunk([itemId])));
          } catch (itemErr) {
            this.logApiError('identityVideoInfo', itemErr);
          }
        }
      }
    }
    return rows;
  }

  async existingAdPreview(accessToken: string, advertiserId: string, adId: string) {
    return this.materialPreview(accessToken, advertiserId, { preview_type: 'AD', ad_id: adId });
  }

  async materialPreview(accessToken: string, advertiserId: string, body: Record<string, unknown>) {
    const { data } = await this.http.post(
      '/creative/ads_preview/create/',
      { advertiser_id: advertiserId, ...body },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'adPreview');
    return previewFromPayload((data.data ?? {}) as Record<string, unknown>);
  }

  async imageCover(accessToken: string, advertiserId: string, imageIds: string[]) {
    const covers = await this.imageCovers(accessToken, advertiserId, imageIds);
    return covers.values().next().value ?? '';
  }

  async imageCovers(accessToken: string, advertiserId: string, imageIds: string[]) {
    const unique = [...new Set(imageIds.filter(Boolean))];
    const covers = new Map<string, string>();
    for (let offset = 0; offset < unique.length; offset += 20) {
      const chunk = unique.slice(offset, offset + 20);
      try {
        const { data } = await this.http.get('/file/image/ad/info/', {
          params: { advertiser_id: advertiserId, image_ids: JSON.stringify(chunk) },
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'imageInfo');
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        for (const row of list) {
          const media = readTikTokMedia(row);
          const url = media.posterUrl || media.videoUrl;
          const imageId = String(row.image_id ?? '');
          if (imageId && url) covers.set(imageId, url);
        }
      } catch (err) {
        this.logApiError('imageInfo', err);
      }
    }
    return covers;
  }

  async listSparkMedia(accessToken: string, advertiserId: string) {
    const media = new Map<string, { posterUrl: string; videoUrl: string; text: string }>();
    for (let page = 1; page <= 4; page += 1) {
      try {
        const { data } = await this.http.get('/tt_video/list/', {
          params: { advertiser_id: advertiserId, page, page_size: 50 },
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'sparkVideoList');
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        for (const row of list) {
          const item = readTikTokMedia(row);
          if (!item.itemId) continue;
          media.set(item.itemId, { posterUrl: item.posterUrl, videoUrl: item.videoUrl, text: item.text });
        }
        if (list.length < 50) break;
      } catch (err) {
        this.logApiError('sparkVideoList', err);
        break;
      }
    }
    return media;
  }

  async publicItemCovers(itemIds: string[]) {
    const covers = new Map<string, string>();
    // Fetch enough covers for long campaign rows (was capped at 16 → many blank thumbs).
    const pending = [...new Set(itemIds.filter(Boolean))].slice(0, 120);
    const workers = Array.from({ length: Math.min(8, pending.length || 1) }, async () => {
      while (pending.length) {
        const itemId = pending.shift();
        if (!itemId || covers.has(itemId)) continue;
        const posterUrl = await this.publicItemCover(itemId);
        if (posterUrl) covers.set(itemId, posterUrl);
      }
    });
    await Promise.all(workers);
    return covers;
  }

  async publicItemCover(itemId: string) {
    if (!itemId) return '';
    try {
      const { data } = await axios.get('https://www.tiktok.com/oembed', {
        params: { url: `https://www.tiktok.com/@tiktok/video/${itemId}` },
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : '';
    } catch {
      return '';
    }
  }

  async videoFileInfo(accessToken: string, advertiserId: string, videoIds: string[]) {
    const unique = [...new Set(videoIds.filter(Boolean))];
    const rows: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < unique.length; offset += 60) {
      const chunk = unique.slice(offset, offset + 60);
      try {
        const { data } = await this.http.get('/file/video/ad/info/', {
          params: { advertiser_id: advertiserId, video_ids: JSON.stringify(chunk) },
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'videoFileInfo');
        rows.push(...((data.data?.list ?? []) as Array<Record<string, unknown>>));
      } catch (err) {
        this.logApiError('videoFileInfo', err);
      }
    }
    return rows;
  }

  async updateCampaignName(accessToken: string, advertiserId: string, campaignId: string, name: string) {
    const { data } = await this.http.post(
      '/campaign/update/',
      { advertiser_id: advertiserId, campaign_id: campaignId, campaign_name: name },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'updateCampaign');
  }

  async updateAdGroup(accessToken: string, body: Record<string, unknown>) {
    const payload = { ...body };
    if (Array.isArray(payload.operating_systems)) {
      const systems = (payload.operating_systems as unknown[])
        .map((item) => String(item).toUpperCase())
        .filter((item) => item === 'ANDROID' || item === 'IOS');
      if (systems.length === 1) payload.operating_systems = systems;
      else delete payload.operating_systems;
    }
    await this.withEntityUpdateRetry('updateAdGroup', async () => {
      const { data } = await this.http.post('/adgroup/update/', payload, { headers: { 'Access-Token': accessToken } });
      this.assertOk(data, 'updateAdGroup');
    });
  }

  async updateAds(accessToken: string, advertiserId: string, adGroupId: string, creatives: Array<Record<string, unknown>>) {
    await this.withEntityUpdateRetry('updateAd', async () => {
      const { data } = await this.http.post(
        '/ad/update/',
        { advertiser_id: advertiserId, adgroup_id: adGroupId, creatives },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateAd');
    });
  }

  async deleteCampaigns(accessToken: string, advertiserId: string, campaignIds: string[]) {
    const unique = [...new Set(campaignIds.filter(Boolean))];
    for (let index = 0; index < unique.length; index += 20) {
      const chunk = unique.slice(index, index + 20);
      await this.withEntityUpdateRetry('deleteCampaign', async () => {
        const { data } = await this.http.post(
          '/campaign/status/update/',
          { advertiser_id: advertiserId, campaign_ids: chunk, operation_status: 'DELETE' },
          { headers: { 'Access-Token': accessToken } },
        );
        this.assertOk(data, 'deleteCampaign');
      });
      if (index + 20 < unique.length) await this.sleep(800);
    }
  }

  async setCampaignStatus(accessToken: string, advertiserId: string, campaignIds: string[], status: 'ENABLE' | 'DISABLE') {
    if (!campaignIds.length) return;
    await this.withEntityUpdateRetry('updateCampaignStatus', async () => {
      const { data } = await this.http.post(
        '/campaign/status/update/',
        { advertiser_id: advertiserId, campaign_ids: campaignIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateCampaignStatus');
    });
  }

  async setSmartPlusCampaignStatus(accessToken: string, advertiserId: string, campaignIds: string[], status: 'ENABLE' | 'DISABLE') {
    if (!campaignIds.length) return;
    await this.withEntityUpdateRetry('updateSmartPlusCampaignStatus', async () => {
      const { data } = await this.http.post(
        '/smart_plus/campaign/status/update/',
        { advertiser_id: advertiserId, campaign_ids: campaignIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateSmartPlusCampaignStatus');
    });
  }

  /** يحدّث حالة الحملة على تيك توك (يدوي أو Smart+) ويعيد الحالة الفعلية */
  async setCampaignStatusLive(
    accessToken: string,
    advertiserId: string,
    campaignId: string,
    status: 'ENABLE' | 'DISABLE',
  ) {
    const id = String(campaignId || '').trim();
    if (!id) return status;
    const smart = await this.isUpgradedSmartPlusCampaign(accessToken, advertiserId, id);
    if (smart) {
      await this.setSmartPlusCampaignStatus(accessToken, advertiserId, [id], status);
    } else {
      try {
        await this.setCampaignStatus(accessToken, advertiserId, [id], status);
      } catch (err) {
        // حملات Smart+ قد تفشل على المسار الكلاسيكي
        this.logger.warn(`[Marketing API] classic campaign status failed, retry Smart+: ${err instanceof Error ? err.message : String(err)}`);
        await this.setSmartPlusCampaignStatus(accessToken, advertiserId, [id], status);
      }
    }
    // TikTok often returns stale ENABLE for a few seconds after DISABLE — trust the write.
    await this.sleep(1200);
    const live = await this.readCampaignOperationStatus(accessToken, advertiserId, id, status);
    if (live !== status) {
      this.logger.warn(`[Marketing API] campaign ${id} readback=${live} after write=${status}; returning requested status`);
      return status;
    }
    return live;
  }

  async setAdGroupStatus(accessToken: string, advertiserId: string, adGroupIds: string[], status: 'ENABLE' | 'DISABLE') {
    if (!adGroupIds.length) return;
    await this.withEntityUpdateRetry('updateAdGroupStatus', async () => {
      const { data } = await this.http.post(
        '/adgroup/status/update/',
        { advertiser_id: advertiserId, adgroup_ids: adGroupIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateAdGroupStatus');
    });
  }

  async setSmartPlusAdGroupStatus(accessToken: string, advertiserId: string, adGroupIds: string[], status: 'ENABLE' | 'DISABLE') {
    if (!adGroupIds.length) return;
    await this.withEntityUpdateRetry('updateSmartPlusAdGroupStatus', async () => {
      const { data } = await this.http.post(
        '/smart_plus/adgroup/status/update/',
        { advertiser_id: advertiserId, adgroup_ids: adGroupIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateSmartPlusAdGroupStatus');
    });
  }

  async setAdGroupStatusLive(
    accessToken: string,
    advertiserId: string,
    adGroupId: string,
    status: 'ENABLE' | 'DISABLE',
  ) {
    const id = String(adGroupId || '').trim();
    if (!id) return status;
    try {
      await this.setAdGroupStatus(accessToken, advertiserId, [id], status);
    } catch (err) {
      this.logger.warn(`[Marketing API] classic adgroup status failed, retry Smart+: ${err instanceof Error ? err.message : String(err)}`);
      await this.setSmartPlusAdGroupStatus(accessToken, advertiserId, [id], status);
    }
    return this.readAdGroupOperationStatus(accessToken, advertiserId, id, status);
  }

  async setAdStatus(accessToken: string, advertiserId: string, adIds: string[], status: 'ENABLE' | 'DISABLE' | 'DELETE') {
    if (!adIds.length) return;
    await this.withEntityUpdateRetry('updateAdStatus', async () => {
      const { data } = await this.http.post(
        '/ad/status/update/',
        { advertiser_id: advertiserId, ad_ids: adIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateAdStatus');
    });
  }

  async setSmartPlusAdStatus(accessToken: string, advertiserId: string, adIds: string[], status: 'ENABLE' | 'DISABLE' | 'DELETE') {
    if (!adIds.length) return;
    await this.withEntityUpdateRetry('updateSmartPlusAdStatus', async () => {
      const { data } = await this.http.post(
        '/smart_plus/ad/status/update/',
        { advertiser_id: advertiserId, smart_plus_ad_ids: adIds, operation_status: status },
        { headers: { 'Access-Token': accessToken } },
      );
      this.assertOk(data, 'updateSmartPlusAdStatus');
    });
  }

  async setAdStatusLive(
    accessToken: string,
    advertiserId: string,
    adId: string,
    status: 'ENABLE' | 'DISABLE' | 'DELETE',
  ) {
    const id = String(adId || '').trim();
    if (!id) return status;
    try {
      await this.setAdStatus(accessToken, advertiserId, [id], status);
    } catch (err) {
      this.logger.warn(`[Marketing API] classic ad status failed, retry Smart+: ${err instanceof Error ? err.message : String(err)}`);
      await this.setSmartPlusAdStatus(accessToken, advertiserId, [id], status);
    }
    if (status === 'DELETE') return status;
    return this.readAdOperationStatus(accessToken, advertiserId, id, status);
  }

  private async readCampaignOperationStatus(
    accessToken: string,
    advertiserId: string,
    campaignId: string,
    fallback: 'ENABLE' | 'DISABLE',
  ) {
    try {
      const rows = await this.listForCampaign(accessToken, '/campaign/get/', advertiserId, campaignId);
      const row = rows.find((item) => String(item.campaign_id ?? '') === campaignId) ?? rows[0];
      const value = String(row?.operation_status ?? '').toUpperCase();
      if (value === 'ENABLE' || value === 'DISABLE') return value;
    } catch {
      /* ignore */
    }
    try {
      const { data } = await this.http.get('/smart_plus/campaign/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ campaign_ids: [campaignId] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        const row = list.find((item) => String(item.campaign_id ?? '') === campaignId) ?? list[0];
        const value = String(row?.operation_status ?? '').toUpperCase();
        if (value === 'ENABLE' || value === 'DISABLE') return value;
      }
    } catch {
      /* ignore */
    }
    return fallback;
  }

  private async readAdGroupOperationStatus(
    accessToken: string,
    advertiserId: string,
    adGroupId: string,
    fallback: 'ENABLE' | 'DISABLE',
  ) {
    try {
      const { data } = await this.http.get('/adgroup/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        const row = list.find((item) => String(item.adgroup_id ?? '') === adGroupId) ?? list[0];
        const value = String(row?.operation_status ?? '').toUpperCase();
        if (value === 'ENABLE' || value === 'DISABLE') return value;
      }
    } catch {
      /* ignore */
    }
    try {
      const { data } = await this.http.get('/smart_plus/adgroup/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        const row = list.find((item) => String(item.adgroup_id ?? '') === adGroupId) ?? list[0];
        const value = String(row?.operation_status ?? '').toUpperCase();
        if (value === 'ENABLE' || value === 'DISABLE') return value;
      }
    } catch {
      /* ignore */
    }
    return fallback;
  }

  private async readAdOperationStatus(
    accessToken: string,
    advertiserId: string,
    adId: string,
    fallback: 'ENABLE' | 'DISABLE',
  ) {
    try {
      const { data } = await this.http.get('/ad/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ ad_ids: [adId] }),
          page: 1,
          page_size: 1,
          fields: JSON.stringify(['ad_id', 'operation_status']),
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        const row = list.find((item) => String(item.ad_id ?? '') === adId) ?? list[0];
        const value = String(row?.operation_status ?? '').toUpperCase();
        if (value === 'ENABLE' || value === 'DISABLE') return value;
      }
    } catch {
      /* ignore */
    }
    try {
      const { data } = await this.http.get('/smart_plus/ad/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ smart_plus_ad_ids: [adId] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        const row = list.find((item) => String(item.smart_plus_ad_id ?? item.ad_id ?? '') === adId) ?? list[0];
        const value = String(row?.operation_status ?? '').toUpperCase();
        if (value === 'ENABLE' || value === 'DISABLE') return value;
      }
    } catch {
      /* ignore */
    }
    return fallback;
  }

  async createMarketingCampaign(
    accessToken: string,
    input: {
      advertiserId: string;
      name: string;
      objectiveType: string;
      searchCampaign?: boolean;
      salesDestination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE';
      campaignProductSource?: 'STORE' | 'CATALOG';
    },
  ) {
    const body: Record<string, unknown> = {
      advertiser_id: input.advertiserId,
      campaign_name: input.name,
      objective_type: input.objectiveType,
      budget_mode: 'BUDGET_MODE_INFINITE',
      operation_status: 'ENABLE',
    };
    if (input.searchCampaign) body.campaign_type = 'SEARCH';
    // فصل كامل: WEB_CONVERSIONS ≠ PRODUCT_SALES — لا نرسل virtual_objective_type=SALES ولا sales_destination
    if (input.objectiveType === 'WEB_CONVERSIONS') {
      delete body.virtual_objective_type;
      delete body.sales_destination;
      delete body.campaign_product_source;
    } else if (input.objectiveType === 'PRODUCT_SALES') {
      const source = input.campaignProductSource
        || (input.salesDestination === 'STORE' || !input.salesDestination ? 'STORE' : 'CATALOG');
      body.campaign_product_source = source;
    }
    if (input.objectiveType === 'WEB_CONVERSIONS' && (input.salesDestination || input.campaignProductSource)) {
      this.logger.warn(
        `[Marketing API] stripped Sales fields from WEB_CONVERSIONS (salesDestination=${String(input.salesDestination)} productSource=${String(input.campaignProductSource)})`,
      );
    }
    assertCampaignBodyMatchesRoute(input.objectiveType, body);
    this.logger.log(
      `[Marketing API] createCampaign objective=${input.objectiveType}`
      + ` product_source=${String(body.campaign_product_source ?? '-')}`
      + ` (no Sales merge fields)`,
    );
    return this.withEntityUpdateRetry('createCampaign', async () => {
      const { data } = await this.http.post('/campaign/create/', body, {
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'createCampaign');
      const campaignId = String(data.data?.campaign_id ?? '');
      if (!campaignId) throw new Error('TikTok did not return a campaign id');
      return campaignId;
    });
  }

  /** request_id لـ Smart+ يجب أن يكون تمثيلاً نصياً لعدد int64 فقط */
  private smartPlusRequestId() {
    return `${Date.now()}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
  }

  async isUpgradedSmartPlusCampaign(accessToken: string, advertiserId: string, campaignId: string) {
    const id = String(campaignId || '').trim();
    if (!id) return false;
    try {
      const { data } = await this.http.get('/campaign/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ campaign_ids: [id] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'getCampaignSmartPlusFlag');
      const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
      const row = list.find((item) => String(item.campaign_id ?? '') === id) ?? list[0] ?? {};
      const smartFlag = row.is_smart_performance_campaign === true
        || row.is_smart_performance_campaign === 'true'
        || String(row.campaign_automation_type ?? '').toUpperCase().includes('SMART')
        || String(row.virtual_objective_type ?? '').toUpperCase().includes('SMART')
        || String(row.smart_plus_adgroup_mode ?? '').length > 0
        || String(row.is_smart_performance_campaign ?? '').toUpperCase() === 'TRUE';
      if (smartFlag) return true;
    } catch (err) {
      this.logger.warn(`[Marketing API] isUpgradedSmartPlusCampaign classic get failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const { data } = await this.http.get('/smart_plus/campaign/get/', {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ campaign_ids: [id] }),
          page: 1,
          page_size: 1,
        },
        headers: { 'Access-Token': accessToken },
      });
      if (Number(data?.code) === 0) {
        const list = (data.data?.list ?? []) as Array<Record<string, unknown>>;
        return list.some((row) => String(row.campaign_id ?? '') === id);
      }
    } catch (err) {
      this.logger.warn(`[Marketing API] isUpgradedSmartPlusCampaign smart_plus get failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return false;
  }

  async createSmartPlusCampaign(
    accessToken: string,
    input: {
      advertiserId: string;
      name: string;
      objectiveType: string;
      salesDestination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE';
      budget: number;
      budgetMode: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL';
    },
  ) {
    const budget = Number(input.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new Error('أدخل ميزانية أكبر من صفر لحملة Smart+');
    }
    // Smart+ مع تحسين ميزانية الحملة (CBO): DAY → DYNAMIC_DAILY، TOTAL يبقى TOTAL
    const budgetMode = input.budgetMode === 'BUDGET_MODE_TOTAL'
      ? 'BUDGET_MODE_TOTAL'
      : 'BUDGET_MODE_DYNAMIC_DAILY_BUDGET';
    // Smart+: LEAD_GENERATION | APP_PROMOTION | WEB_CONVERSIONS (مبيعات→موقع ويب)
    // PRODUCT_SALES / متجر: غير مدعوم — يُحوَّل مسبقاً إلى WEB_CONVERSIONS+WEBSITE
    if (input.objectiveType === 'PRODUCT_SALES') {
      throw new Error(
        'تيك توك لا يدعم Smart+ لمتجر تيك توك مباشرة. استخدم مبيعات → موقع ويب (Smart+).',
      );
    }
    if (!['LEAD_GENERATION', 'APP_PROMOTION', 'WEB_CONVERSIONS'].includes(input.objectiveType)) {
      throw new Error(`هدف الحملة ${input.objectiveType} غير مدعوم مع Smart+`);
    }
    const body: Record<string, unknown> = {
      advertiser_id: input.advertiserId,
      campaign_name: input.name,
      objective_type: input.objectiveType,
      request_id: this.smartPlusRequestId(),
      budget_optimize_on: true,
      budget_mode: budgetMode,
      budget,
      smart_plus_adgroup_mode: 'MULTIPLE',
      operation_status: 'ENABLE',
    };
    if (input.objectiveType === 'WEB_CONVERSIONS') {
      // مسار مبيعات Smart+ الرسمي في تيك توك
      body.sales_destination = input.salesDestination || 'WEBSITE';
    }
    this.logger.log(
      `[Marketing API] createSmartPlusCampaign objective=${input.objectiveType}`
      + ` sales_destination=${String(body.sales_destination ?? '-')}`,
    );
    return this.withEntityUpdateRetry('createSmartPlusCampaign', async () => {
      const { data } = await this.http.post('/smart_plus/campaign/create/', body, {
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'createSmartPlusCampaign');
      const campaignId = String(data.data?.campaign_id ?? '');
      if (!campaignId) throw new Error('TikTok did not return a Smart+ campaign id');
      return campaignId;
    });
  }

  async createMarketingAdGroup(accessToken: string, body: Record<string, unknown>) {
    const payload = { ...body };
    const promotion = String(payload.promotion_type ?? '');
    const goal = String(payload.optimization_goal ?? '');
    // tiktok_subplacements صالح فقط لـ REACH / VIDEO_VIEWS / ENGAGEMENT
    const allowsSubplacements = ['REACH', 'ENGAGED_VIEW', 'ENGAGED_VIEW_FIFTEEN', 'FOLLOWERS', 'PAGE_VISIT'].includes(goal);
    if (!allowsSubplacements) {
      delete payload.tiktok_subplacements;
    }
    // PRODUCT_SALES / متجر: تيك توك فقط
    if (promotion === 'PSA_PRODUCT' || payload.shopping_ads_type) {
      payload.placement_type = 'PLACEMENT_TYPE_NORMAL';
      payload.placements = ['PLACEMENT_TIKTOK'];
      delete payload.tiktok_subplacements;
      delete payload.search_result_enabled;
    }
    // Lead Gen يدوي: تيك توك فقط وبدون مواضع فرعية
    if (promotion === 'LEAD_GENERATION' && payload.placement_type !== 'PLACEMENT_TYPE_AUTOMATIC') {
      payload.placement_type = 'PLACEMENT_TYPE_NORMAL';
      payload.placements = ['PLACEMENT_TIKTOK'];
      delete payload.tiktok_subplacements;
      delete payload.search_result_enabled;
    }
    // WEB_CONVERSIONS (CONVERT + WEBSITE بدون Lead): تيك توك فقط وبدون مواضع فرعية
    if (promotion === 'WEBSITE' && goal === 'CONVERT' && !payload.shopping_ads_type) {
      payload.placement_type = 'PLACEMENT_TYPE_NORMAL';
      payload.placements = ['PLACEMENT_TIKTOK'];
      delete payload.tiktok_subplacements;
      delete payload.search_result_enabled;
    }
    // operating_systems: قيمة واحدة فقط؛ أكثر من قيمة أو قائمة فارغة = استهداف غير محدود
    if (Array.isArray(payload.operating_systems)) {
      const systems = (payload.operating_systems as unknown[])
        .map((item) => String(item).toUpperCase())
        .filter((item) => item === 'ANDROID' || item === 'IOS');
      if (systems.length === 1) payload.operating_systems = systems;
      else delete payload.operating_systems;
    }
    this.logger.log(
      `[Marketing API] createAdGroup placement_type=${String(payload.placement_type)}`
      + ` placements=${JSON.stringify(payload.placements ?? null)}`
      + ` os=${JSON.stringify(payload.operating_systems ?? null)}`
      + ` subs=${JSON.stringify(payload.tiktok_subplacements ?? null)}`
      + ` promotion=${promotion} goal=${goal}`,
    );
    return this.withEntityUpdateRetry('createAdGroup', async () => {
      const { data } = await this.http.post('/adgroup/create/', payload, {
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'createAdGroup');
      const adGroupId = String(data.data?.adgroup_id ?? '');
      if (!adGroupId) throw new Error('TikTok did not return an ad group id');
      return adGroupId;
    });
  }

  async createSmartPlusAdGroup(accessToken: string, body: Record<string, unknown>) {
    const targetingKeys = [
      'location_ids',
      'zipcode_ids',
      'languages',
      'gender',
      'age_groups',
      'audience_ids',
      'excluded_audience_ids',
      'interest_category_ids',
      'interest_keyword_ids',
      'purchase_intention_keyword_ids',
      'actions',
      'operating_systems',
      'min_android_version',
      'min_ios_version',
      'network_types',
      'carrier_ids',
      'isp_ids',
      'device_price_ranges',
      'device_model_ids',
      'spending_power',
      'household_income',
      'smart_interest_behavior_enabled',
      'smart_audience_enabled',
      'spc_audience_age',
      'saved_audience_id',
      'blocked_pangle_app_ids',
      'included_pangle_audience_package_ids',
      'excluded_pangle_audience_package_ids',
    ] as const;

    const existingSpec = body.targeting_spec && typeof body.targeting_spec === 'object' && !Array.isArray(body.targeting_spec)
      ? { ...(body.targeting_spec as Record<string, unknown>) }
      : {};
    const targetingSpec: Record<string, unknown> = { ...existingSpec };
    for (const key of targetingKeys) {
      if (body[key] !== undefined && targetingSpec[key] === undefined) {
        targetingSpec[key] = body[key];
      }
    }
    // تيك توك: operating_systems قيمة واحدة فقط — الكل = حذف الحقل
    if (Array.isArray(targetingSpec.operating_systems)) {
      const systems = (targetingSpec.operating_systems as unknown[])
        .map((item) => String(item).toUpperCase())
        .filter((item) => item === 'ANDROID' || item === 'IOS');
      if (systems.length === 1) targetingSpec.operating_systems = systems;
      else delete targetingSpec.operating_systems;
    }
    if (!Array.isArray(targetingSpec.location_ids) || !(targetingSpec.location_ids as unknown[]).length) {
      throw new Error('حدد موقعاً جغرافياً واحداً على الأقل قبل نشر حملة Smart+');
    }

    const drop = new Set<string>([
      ...targetingKeys,
      'targeting_spec',
      'frequency',
      'frequency_schedule',
      'tiktok_subplacements',
      'cpv_video_duration',
      'page_id',
      // ميزانية Smart+ على مستوى الحملة (CBO) — لا تُرسل على المجموعة
      'budget',
      'budget_mode',
    ]);
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (drop.has(key) || value === undefined) continue;
      payload[key] = value;
    }
    payload.targeting_spec = targetingSpec;
    payload.request_id = typeof body.request_id === 'string' && /^\d+$/.test(body.request_id)
      ? body.request_id
      : this.smartPlusRequestId();
    // مواضع Smart+ حسب الهدف (تيك توك يختلف بينها):
    // - WEB_CONVERSIONS: يدعم فقط PLACEMENT_TYPE_NORMAL (+ placements)
    // - LEAD_GENERATION: AUTOMATIC (NORMAL+subs كان يسبب Invalid selection)
    // - APP_PROMOTION: AUTOMATIC افتراضياً
    const objectiveType = String(body.objective_type ?? '');
    const promotionType = String(body.promotion_type ?? '');
    const isLeadSmart = objectiveType === 'LEAD_GENERATION' || promotionType === 'LEAD_GENERATION';
    const isWebSmart = objectiveType === 'WEB_CONVERSIONS'
      || (promotionType === 'WEBSITE' && String(body.optimization_goal ?? '') === 'CONVERT' && !body.shopping_ads_type);
    delete payload.tiktok_subplacements;
    delete payload.search_result_enabled;
    if (isWebSmart) {
      payload.placement_type = 'PLACEMENT_TYPE_NORMAL';
      payload.placements = ['PLACEMENT_TIKTOK'];
    } else if (isLeadSmart) {
      payload.placement_type = 'PLACEMENT_TYPE_AUTOMATIC';
      delete payload.placements;
    } else {
      payload.placement_type = 'PLACEMENT_TYPE_AUTOMATIC';
      delete payload.placements;
    }
    if (payload.suggestion_audience_enabled === undefined) payload.suggestion_audience_enabled = true;
    if (payload.targeting_optimization_mode === undefined) payload.targeting_optimization_mode = 'AUTOMATIC';

    return this.withEntityUpdateRetry('createSmartPlusAdGroup', async () => {
      const { data } = await this.http.post('/smart_plus/adgroup/create/', payload, {
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'createSmartPlusAdGroup');
      const adGroupId = String(data.data?.adgroup_id ?? data.data?.smart_plus_adgroup_id ?? '');
      if (!adGroupId) throw new Error('TikTok did not return a Smart+ ad group id');
      return adGroupId;
    });
  }

  async createMarketingAds(
    accessToken: string,
    advertiserId: string,
    adGroupId: string,
    creatives: Array<Record<string, unknown>>,
  ) {
    const adIds: string[] = [];
    // Create one creative at a time to avoid TikTok concurrent entity-update limits.
    for (let i = 0; i < creatives.length; i += 1) {
      if (i > 0) await this.sleep(900);
      const chunk = [creatives[i]];
      const ids = await this.withEntityUpdateRetry('createAd', async () => {
        const { data } = await this.http.post(
          '/ad/create/',
          { advertiser_id: advertiserId, adgroup_id: adGroupId, creatives: chunk },
          { headers: { 'Access-Token': accessToken } },
        );
        this.assertOk(data, 'createAd');
        return ((data.data?.ad_ids ?? []) as Array<string | number>).map(String);
      });
      adIds.push(...ids);
    }
    return adIds;
  }

  async recommendCallToActions(
    accessToken: string,
    advertiserId: string,
    opts?: { objectiveType?: string; promotionType?: string; contentType?: string },
  ): Promise<Array<{ content: string; ids: string[] }>> {
    try {
      const classic = await this.http.get('/creative/cta/recommend/', {
        headers: { 'Access-Token': accessToken },
        params: {
          advertiser_id: advertiserId,
          asset_type: 'CTA_NORMAL',
          content_type: opts?.contentType || 'LANDING_PAGE',
          objective_type: opts?.objectiveType || 'WEB_CONVERSIONS',
        },
      });
      if (Number(classic.data?.code) === 0) {
        const rows = (classic.data?.data?.recommend_assets ?? []) as Array<Record<string, unknown>>;
        const mapped = rows.map((row) => ({
          content: String(row.asset_content ?? '').trim(),
          ids: Array.isArray(row.asset_ids) ? row.asset_ids.map(String) : [],
        })).filter((row) => row.content && row.ids.length);
        if (mapped.length) return mapped;
      }
      const modern = await this.http.get('/creative/cta/recommend/', {
        headers: { 'Access-Token': accessToken },
        params: {
          advertiser_id: advertiserId,
          new_version: true,
          ...(opts?.objectiveType ? { objective_type: opts.objectiveType } : {}),
          ...(opts?.promotionType ? { promotion_type: opts.promotionType } : {}),
        },
      });
      const rows = (modern.data?.data?.recommend_assets ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        content: String(row.asset_content ?? '').trim(),
        ids: Array.isArray(row.asset_ids) ? row.asset_ids.map(String) : [],
      })).filter((row) => row.content && row.ids.length);
    } catch (err) {
      this.logger.warn(`[Marketing API] recommendCallToActions failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  async createCtaPortfolio(
    accessToken: string,
    advertiserId: string,
    assets: Array<{ content: string; ids: string[] }>,
  ): Promise<string> {
    const portfolioContent = assets.slice(0, 10).map((asset) => ({
      asset_content: asset.content,
      asset_ids: asset.ids.slice(0, 2),
    }));
    if (!portfolioContent.length) return '';
    const { data } = await this.http.post(
      '/creative/portfolio/create/',
      {
        advertiser_id: advertiserId,
        creative_portfolio_type: 'CTA',
        portfolio_content: portfolioContent,
      },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'createCtaPortfolio');
    return String(data.data?.creative_portfolio_id ?? data.data?.portfolio_id ?? '');
  }

  /** رفع صورة إعلان إلى مكتبة تيك توك (بطاقة العرض). */
  async uploadAdImage(
    accessToken: string,
    advertiserId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    const fileName = (file.originalname || `display-card-${Date.now()}.jpg`).slice(0, 100);
    const signature = createHash('md5').update(file.buffer).digest('hex');
    const form = new FormData();
    form.append('advertiser_id', advertiserId);
    form.append('upload_type', 'UPLOAD_BY_FILE');
    form.append('image_signature', signature);
    form.append('file_name', fileName);
    form.append(
      'image_file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'image/jpeg' }),
      fileName,
    );
    const { data } = await axios.post(`${TIKTOK_MARKETING_API_BASE}/file/image/ad/upload/`, form, {
      headers: { 'Access-Token': accessToken },
      timeout: 60_000,
      maxBodyLength: Infinity,
    });
    this.assertOk(data, 'uploadAdImage');
    const imageId = String(data.data?.image_id ?? data.data?.id ?? '');
    const previewUrl = String(data.data?.url ?? data.data?.image_url ?? '');
    if (!imageId) throw new Error('TikTok did not return image_id');
    return { imageId, previewUrl };
  }

  /** إنشاء بطاقة عرض (Display Card) في مكتبة الوظائف التفاعلية. */
  async createDisplayCardPortfolio(
    accessToken: string,
    advertiserId: string,
    input: { imageId: string; landingPageUrl?: string; title?: string },
  ) {
    const content: Record<string, unknown> = {
      card_type: 'IMAGE',
      image_id: input.imageId,
    };
    if (input.title?.trim()) content.title = input.title.trim().slice(0, 40);
    if (input.landingPageUrl?.trim()) {
      content.sticker_param = { landing_page_url: input.landingPageUrl.trim() };
    }
    const attempts: Array<Record<string, unknown>> = [
      {
        advertiser_id: advertiserId,
        creative_portfolio_type: 'CARD',
        portfolio_content: [content],
      },
      // بعض الحسابات تقبل البطاقة بدون sticker_param
      {
        advertiser_id: advertiserId,
        creative_portfolio_type: 'CARD',
        portfolio_content: [{ card_type: 'IMAGE', image_id: input.imageId }],
      },
    ];
    let lastError: unknown = null;
    for (const body of attempts) {
      try {
        const { data } = await this.http.post('/creative/portfolio/create/', body, {
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'createDisplayCard');
        const cardId = String(data.data?.creative_portfolio_id ?? data.data?.portfolio_id ?? '');
        if (cardId) return cardId;
      } catch (err) {
        lastError = err;
        this.logger.warn(`[Marketing API] createDisplayCard attempt failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (lastError) throw lastError;
    throw new Error('TikTok did not return display card id');
  }

  async listDisplayCardPortfolios(accessToken: string, advertiserId: string, page = 1, pageSize = 20) {
    const { data } = await this.http.get('/creative/portfolio/list/', {
      headers: { 'Access-Token': accessToken },
      params: {
        advertiser_id: advertiserId,
        page,
        page_size: Math.min(50, Math.max(1, pageSize)),
        filtering: JSON.stringify({ creative_portfolio_types: ['CARD'] }),
      },
    });
    this.assertOk(data, 'listDisplayCards');
    const rows = (data.data?.creative_portfolios ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
    const cards = rows.map((row) => {
      const content = (row.creative_portfolio_content ?? row.portfolio_content ?? {}) as Record<string, unknown>;
      const imageId = String(content.image_id ?? '');
      return {
        cardId: String(row.creative_portfolio_id ?? row.portfolio_id ?? ''),
        cardType: String(content.card_type ?? 'IMAGE'),
        imageId,
        previewUrl: String(
          row.creative_portfolio_preview_url
          ?? content.content_url
          ?? content.preview_url
          ?? '',
        ),
        title: String(content.title ?? content.primary_text ?? content.description ?? ''),
        createdAt: String(row.create_time ?? row.created_at ?? ''),
        modifiedAt: String(row.modify_time ?? row.updated_at ?? ''),
      };
    }).filter((row) => row.cardId);
    return {
      cards,
      page: Number(data.data?.page ?? page),
      pageSize: Number(data.data?.page_size ?? pageSize),
      total: Number(data.data?.total_number ?? data.data?.total ?? cards.length),
    };
  }

  private normalizeCtaKey(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '_').replace(/_+$/g, '');
  }

  private isCtaError(message: string) {
    return /call[\s_]?to[\s_]?action|cta/i.test(message);
  }

  async createSmartPlusAds(
    accessToken: string,
    advertiserId: string,
    adGroupId: string,
    creatives: Array<Record<string, unknown>>,
    opts?: { objectiveType?: string; promotionType?: string; adName?: string },
  ) {
    if (!creatives.length) throw new Error('اختر فيديو واحداً على الأقل');

    const recommended = await this.recommendCallToActions(accessToken, advertiserId, {
      objectiveType: opts?.objectiveType || 'WEB_CONVERSIONS',
      promotionType: opts?.promotionType || 'WEBSITE',
    });
    let portfolioId = '';
    if (recommended.length) {
      try {
        portfolioId = await this.createCtaPortfolio(accessToken, advertiserId, recommended);
      } catch (err) {
        this.logger.warn(`[Marketing API] createCtaPortfolio failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const contentToEnum: Record<string, string> = {
      LEARN_MORE: 'LEARN_MORE',
      SHOP_NOW: 'SHOP_NOW',
      SIGN_UP: 'SIGN_UP',
      ORDER_NOW: 'ORDER_NOW',
      BOOK_NOW: 'BOOK_NOW',
      DOWNLOAD_NOW: 'DOWNLOAD_NOW',
      DOWNLOAD: 'DOWNLOAD_NOW',
      APPLY_NOW: 'APPLY_NOW',
      SUBSCRIBE: 'SUBSCRIBE',
      GET_QUOTE: 'GET_QUOTE',
      WATCH_NOW: 'WATCH_NOW',
      CONTACT_US: 'CONTACT_US',
      VISIT_STORE: 'VISIT_STORE',
      INTERESTED: 'INTERESTED',
      VIEW_NOW: 'VIEW_NOW',
      READ_MORE: 'READ_MORE',
      CHECK_IT_OUT: 'VIEW_NOW',
      PLAY_GAME_CTA: 'PLAY_GAME',
      LISTEN_NOW: 'LISTEN_NOW',
    };

    // أداة التصميم الإبداعي الذكي: كل الفيديوهات داخل إعلان واحد
    const cardId = String(creatives[0]?.card_id ?? '').trim();
    const creativeList = creatives.slice(0, 50).map((creative) => {
      const identityId = String(creative.identity_id ?? '').trim();
      const identityType = String(creative.identity_type ?? '').trim();
      const identityAuthorizedBcId = String(creative.identity_authorized_bc_id ?? '').trim();
      const itemId = String(creative.tiktok_item_id ?? '').trim();
      const creativeInfo: Record<string, unknown> = {
        ad_format: String(creative.ad_format ?? 'SINGLE_VIDEO'),
        identity_id: identityId,
        identity_type: identityType,
        tiktok_item_id: itemId,
      };
      if (identityAuthorizedBcId) creativeInfo.identity_authorized_bc_id = identityAuthorizedBcId;
      const creativeCardId = String(creative.card_id ?? cardId).trim();
      if (creativeCardId) creativeInfo.card_id = creativeCardId;
      return { creative_info: creativeInfo };
    });

    const texts = Array.from(new Set(
      creatives
        .map((creative) => String(creative.ad_text ?? creative.ad_name ?? '').trim().slice(0, 100))
        .filter(Boolean),
    )).slice(0, 5);

    const preferred = contentToEnum[this.normalizeCtaKey(String(creatives[0]?.call_to_action ?? 'LEARN_MORE'))] || 'LEARN_MORE';
    const landing = String(creatives[0]?.landing_page_url ?? '').trim();
    const pageId = String(creatives[0]?.page_id ?? '').trim();
    const adName = (
      opts?.adName?.trim()
      || String(creatives[0]?.ad_name ?? '').trim()
      || `Ad ${Date.now().toString().slice(-6)}`
    ).slice(0, 512);

    const enumCandidates = [
      preferred,
      ...recommended.map((row) => contentToEnum[this.normalizeCtaKey(row.content)]).filter(Boolean),
      'LEARN_MORE',
      'SHOP_NOW',
      'ORDER_NOW',
      'SIGN_UP',
      'WATCH_NOW',
      'CONTACT_US',
    ].filter((value, i, arr): value is string => Boolean(value) && arr.indexOf(value) === i);

    type Attempt = { mode: 'portfolio' | 'enum'; value: string };
    const attempts: Attempt[] = [];
    if (portfolioId) attempts.push({ mode: 'portfolio', value: portfolioId });
    for (const cta of enumCandidates) attempts.push({ mode: 'enum', value: cta });

    let createdId = '';
    let lastError: unknown = null;
    for (const attempt of attempts) {
      const body: Record<string, unknown> = {
        advertiser_id: advertiserId,
        adgroup_id: adGroupId,
        request_id: this.smartPlusRequestId(),
        ad_name: adName,
        operation_status: 'ENABLE',
        creative_list: creativeList,
      };
      if (texts.length) body.ad_text_list = texts.map((ad_text) => ({ ad_text }));
      if (pageId) body.page_list = [{ page_id: pageId }];
      else if (landing) body.landing_page_url_list = [{ landing_page_url: landing }];
      if (cardId) body.card_list = [{ card_id: cardId }];

      if (attempt.mode === 'portfolio') {
        body.ad_configuration = { call_to_action_id: attempt.value };
      } else {
        body.call_to_action_list = [{ call_to_action: attempt.value }];
      }

      try {
        createdId = await this.withEntityUpdateRetry('createSmartPlusAd', async () => {
          const { data } = await this.http.post('/smart_plus/ad/create/', body, {
            headers: { 'Access-Token': accessToken },
          });
          this.assertOk(data, 'createSmartPlusAd');
          return String(
            data.data?.smart_plus_ad_id
            ?? data.data?.ad_id
            ?? (Array.isArray(data.data?.ad_ids) ? data.data.ad_ids[0] : '')
            ?? (Array.isArray(data.data?.smart_plus_ad_ids) ? data.data.smart_plus_ad_ids[0] : '')
            ?? '',
          );
        });
        if (createdId) {
          this.logger.log(`[Marketing API] Smart+ ad created assets=${creativeList.length} CTA ${attempt.mode}=${attempt.value}`);
          break;
        }
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!this.isCtaError(msg)) throw err;
        this.logger.warn(`[Marketing API] Smart+ CTA rejected (${attempt.mode}=${attempt.value}): ${msg}`);
      }
    }
    if (!createdId) {
      if (lastError) throw lastError;
      throw new Error('TikTok did not return Smart+ ad ids');
    }
    return [createdId];
  }

  async listLanguages(accessToken: string, advertiserId: string) {
    const { data } = await this.http.get('/tool/language/', {
      params: { advertiser_id: advertiserId },
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'listLanguages');
    const list = (data.data?.languages ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
    return list
      .map((row) => ({
        code: String(row.language_code ?? row.code ?? ''),
        name: String(row.name ?? row.language_name ?? row.code ?? ''),
      }))
      .filter((row) => row.code);
  }

  async listCustomAudiences(accessToken: string, advertiserId: string) {
    const rows: Array<{ audienceId: string; name: string; audienceType: string }> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await this.http.get('/dmp/custom_audience/list/', {
        params: { advertiser_id: advertiserId, page: String(page), page_size: '100' },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listCustomAudiences');
      const list = (data.data?.list ?? data.data?.custom_audiences ?? []) as Array<Record<string, unknown>>;
      for (const row of list) {
        const audienceId = String(row.audience_id ?? row.custom_audience_id ?? '');
        if (!audienceId) continue;
        rows.push({
          audienceId,
          name: String(row.name ?? row.audience_name ?? audienceId),
          audienceType: String(row.audience_type ?? row.type ?? ''),
        });
      }
      const total = Number(data.data?.page_info?.total_number ?? list.length);
      if (page * 100 >= total || !list.length) break;
    }
    return rows;
  }

  async listCarriers(accessToken: string, advertiserId: string, locationIds: string[]) {
    if (!locationIds.length) return [] as Array<{ id: string; name: string }>;
    try {
      const { data } = await this.http.get('/tool/carrier/', {
        params: {
          advertiser_id: advertiserId,
          location_ids: JSON.stringify(locationIds.slice(0, 20)),
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listCarriers');
      const list = (data.data?.carriers ?? data.data?.list ?? []) as Array<Record<string, unknown>>;
      return list
        .map((row) => ({
          id: String(row.carrier_id ?? row.id ?? ''),
          name: String(row.name ?? row.carrier_name ?? ''),
        }))
        .filter((row) => row.id && row.name);
    } catch {
      return [];
    }
  }

  async listIsps(accessToken: string, advertiserId: string, locationIds: string[]) {
    if (!locationIds.length) return [] as Array<{ id: string; name: string }>;
    try {
      const { data } = await this.http.get('/tool/targeting/list/', {
        params: {
          advertiser_id: advertiserId,
          location_ids: JSON.stringify(locationIds.slice(0, 20)),
          scene: 'ISP',
        },
        headers: { 'Access-Token': accessToken },
      });
      this.assertOk(data, 'listIsps');
      const list = (data.data?.list ?? data.data?.targeting_tag_list ?? []) as Array<Record<string, unknown>>;
      return list
        .map((row) => ({
          id: String(row.isp_id ?? row.targeting_id ?? row.id ?? ''),
          name: String(row.name ?? row.isp_name ?? row.targeting_name ?? ''),
        }))
        .filter((row) => row.id && row.name);
    } catch {
      return [];
    }
  }

  /**
   * Instant Forms (LEAD_GEN) من مكتبة الحساب الإعلاني.
   * بدون business_type قد تُرجع صفحات غير مناسبة لعميل محتمل.
   */
  async listInstantPages(accessToken: string, advertiserId: string, opts?: { status?: 'PUBLISHED' | 'EDITED' | 'ALL'; page?: number; pageSize?: number }) {
    try {
      const page = Math.max(1, Math.floor(opts?.page ?? 1));
      const pageSize = Math.min(50, Math.max(1, Math.floor(opts?.pageSize ?? 50)));
      const statuses: Array<'PUBLISHED' | 'EDITED' | undefined> =
        opts?.status === 'ALL' || !opts?.status
          ? [undefined]
          : [opts.status];
      const collected: Array<{
        pageId: string;
        name: string;
        thumbnail: string | null;
        previewUrl: string | null;
        status: string;
        createTime: string | null;
        updateTime: string | null;
        publishTime: string | null;
      }> = [];
      const seen = new Set<string>();

      for (const status of statuses) {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page: String(page),
          page_size: String(pageSize),
          business_type: 'LEAD_GEN',
        };
        if (status) params.status = status;
        const { data } = await this.http.get('/page/get/', {
          params,
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'listInstantPages');
        const list = (data.data?.list ?? data.data?.pages ?? []) as Array<Record<string, unknown>>;
        for (const row of list) {
          const pageId = String(row.page_id ?? row.id ?? '').trim();
          if (!pageId || seen.has(pageId)) continue;
          seen.add(pageId);
          collected.push({
            pageId,
            name: String(row.title ?? row.page_name ?? row.name ?? pageId),
            thumbnail: typeof row.thumbnail === 'string' ? row.thumbnail : null,
            previewUrl: typeof row.preview_url === 'string' ? row.preview_url : null,
            status: String(row.status ?? (status || 'PUBLISHED')),
            createTime: typeof row.create_time === 'string' ? row.create_time : null,
            updateTime: typeof row.update_time === 'string' ? row.update_time : null,
            publishTime: typeof row.publish_time === 'string' ? row.publish_time : null,
          });
        }
      }

      // إن فشل الفلتر أو رجعت قائمة فارغة، جرّب بدون business_type ثم صفِّ لاحقاً بالعنوان إن لزم
      if (!collected.length) {
        const { data } = await this.http.get('/page/get/', {
          params: {
            advertiser_id: advertiserId,
            page: String(page),
            page_size: String(pageSize),
            status: 'PUBLISHED',
          },
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'listInstantPagesFallback');
        const list = (data.data?.list ?? data.data?.pages ?? []) as Array<Record<string, unknown>>;
        for (const row of list) {
          const pageId = String(row.page_id ?? row.id ?? '').trim();
          if (!pageId) continue;
          collected.push({
            pageId,
            name: String(row.title ?? row.page_name ?? row.name ?? pageId),
            thumbnail: typeof row.thumbnail === 'string' ? row.thumbnail : null,
            previewUrl: typeof row.preview_url === 'string' ? row.preview_url : null,
            status: String(row.status ?? 'PUBLISHED'),
            createTime: typeof row.create_time === 'string' ? row.create_time : null,
            updateTime: typeof row.update_time === 'string' ? row.update_time : null,
            publishTime: typeof row.publish_time === 'string' ? row.publish_time : null,
          });
        }
      }

      return collected;
    } catch {
      return [];
    }
  }

  /** توكن Tip Editor SDK لفتح محرر الاستمارة الفورية (صالح ~24 ساعة) */
  async createTipSdkAccessToken(accessToken: string, advertiserId: string) {
    const { data } = await this.http.post(
      '/oauth2/access_token/tip_sdk/create/',
      { advertiser_id: advertiserId },
      { headers: { 'Access-Token': accessToken } },
    );
    this.assertOk(data, 'createTipSdkAccessToken');
    const tip = String(
      (data.data as Record<string, unknown> | undefined)?.tip_sdk_access_token
      ?? (data.data as Record<string, unknown> | undefined)?.access_token
      ?? '',
    ).trim();
    if (!tip) throw new Error('لم يُرجع تيك توك رمز محرر الاستمارة الفورية');
    const creds = this.resolveBusinessAppCredentials();
    if (!creds?.appId) throw new Error('TIKTOK_BUSINESS_APP_ID غير مُعد على الخادم');
    return { tipSdkAccessToken: tip, appId: creds.appId };
  }

  /** محاولة إعادة تسمية الاستمارة (إن وُجدت واجهة التحديث في الحساب) */
  async renameInstantPage(accessToken: string, advertiserId: string, pageId: string, title: string) {
    const name = title.trim().slice(0, 100);
    if (!pageId.trim() || !name) throw new Error('معرّف الصفحة والاسم مطلوبان');
    const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
      { path: '/page/update/', body: { advertiser_id: advertiserId, page_id: pageId.trim(), title: name } },
      { path: '/page/name/update/', body: { advertiser_id: advertiserId, page_id: pageId.trim(), title: name } },
    ];
    let lastErr: unknown;
    for (const attempt of attempts) {
      try {
        const { data } = await this.http.post(attempt.path, attempt.body, {
          headers: { 'Access-Token': accessToken },
        });
        this.assertOk(data, 'renameInstantPage');
        return { pageId: pageId.trim(), name };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('تعذّر تعديل اسم الاستمارة عبر واجهة تيك توك');
  }

  async estimateAudienceSize(accessToken: string, body: Record<string, unknown>) {
    const { data } = await this.http.post('/ad/audience_size/estimate/', body, {
      headers: { 'Access-Token': accessToken },
    });
    this.assertOk(data, 'estimateAudienceSize');
    const payload = (data.data ?? {}) as Record<string, unknown>;
    const userCount = asRecord(payload.user_count) ?? payload;
    return {
      lower: Number(userCount.lower_end_user_count ?? userCount.lower ?? payload.lower_end_user_count ?? 0),
      upper: Number(userCount.upper_end_user_count ?? userCount.upper ?? payload.upper_end_user_count ?? 0),
      suggestion: String(payload.suggestion ?? userCount.suggestion ?? ''),
    };
  }

  /**
   * TikTok /pixel/event/create/ expects enum event_type values, not "PIXEL_EVENTS".
   * Contact (WhatsApp message) maps to CONSULT so Ads Manager can mark it Active.
   */
  private toPixelEventType(eventName: string): string {
    switch (eventName) {
      case 'ViewContent':
        return 'VIEW';
      case 'Contact':
        return 'CONSULT';
      case 'Lead':
        return 'FORM';
      case 'CompleteRegistration':
        return 'ON_WEB_REGISTER';
      case 'SubmitForm':
        return 'FORM';
      case 'AddToCart':
        return 'ON_WEB_CART';
      case 'InitiateCheckout':
        return 'INITIATE_ORDER';
      case 'Purchase':
      case 'CompletePayment':
        // SHOPPING = Purchase / Complete Payment في Ads Manager
        // ON_WEB_ORDER = Place an Order (مهمل وغالباً غير مفعّل)
        return 'SHOPPING';
      case 'Custom':
        return 'BUTTON';
      default:
        return 'CONSULT';
    }
  }
}

function identityImage(row: Record<string, unknown>) {
  const candidates = [row.profile_image, row.profile_image_url, row.avatar_url, row.avatar_icon_url, row.image_url];
  for (const value of candidates) {
    if (typeof value === 'string') {
      const url = firstMediaUrl(value);
      if (url) return url;
    }
    const record = asRecord(value);
    if (!record) continue;
    const url = firstMediaUrl(record.url, record.image_url, record.profile_image);
    if (url) return url;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstMediaUrl(...values: unknown[]) {
  return mediaUrlAt(0, values);
}

function mediaUrlAt(depth: number, values: unknown[]) {
  if (depth > 4) return '';
  for (const value of values) {
    const url = unwrapMediaUrl(value, depth);
    if (url) return url;
  }
  return '';
}

function unwrapMediaUrl(value: unknown, depth = 0): string {
  if (depth > 4) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = unwrapMediaUrl(item, depth + 1);
      if (url) return url;
    }
    return '';
  }
  const record = asRecord(value);
  if (!record) return '';
  return mediaUrlAt(depth + 1, [record.url, record.image_url, record.poster_url, record.cover_url, record.url_list]);
}

function videoRowsFromPayload(payload: Record<string, unknown>) {
  const list = payload.list ?? payload.video_details ?? payload.item_list ?? payload.video_list;
  if (Array.isArray(list) && list.length) return list as Array<Record<string, unknown>>;
  const single = asRecord(payload.video_detail) ?? asRecord(payload.item_detail);
  if (single) return [single];
  if (payload.item_id || payload.video_info || payload.tiktok_item_id) return [payload];
  return [] as Array<Record<string, unknown>>;
}

function previewFromPayload(payload: Record<string, unknown>) {
  let previewLink = typeof payload.preview_link === 'string' ? payload.preview_link : '';
  const iframe = typeof payload.iframe === 'string' ? payload.iframe : '';
  if (!previewLink && iframe) {
    const match = iframe.match(/src=["']([^"']+)["']/i);
    previewLink = match?.[1] ?? '';
  }
  return { previewLink, iframe };
}

export function readTikTokMedia(row: Record<string, unknown>) {
  const item = asRecord(row.item_info) ?? asRecord(row.video_detail) ?? asRecord(row.item_detail) ?? row;
  const video = asRecord(row.video_info) ?? asRecord(item.video_info) ?? asRecord(row.video) ?? {};
  const coverKeys = /poster|cover|thumbnail|image_url|preview_image/i;
  const playKeys = /preview_url|play_url|video_url|download_url|^url$/i;
  const extraCovers: unknown[] = [];
  const extraPlays: unknown[] = [];
  for (const source of [row, item, video]) {
    for (const [key, value] of Object.entries(source)) {
      if (coverKeys.test(key)) extraCovers.push(value);
      if (playKeys.test(key) && !coverKeys.test(key)) extraPlays.push(value);
    }
  }
  return {
    itemId: String(item.item_id ?? row.item_id ?? row.tiktok_item_id ?? ''),
    text: String(item.text ?? row.text ?? row.title ?? row.ad_name ?? row.ad_text ?? ''),
    posterUrl: firstMediaUrl(...extraCovers, item.poster_url, row.poster_url, video.poster_url, video.cover_url),
    videoUrl: firstMediaUrl(...extraPlays, video.url, video.preview_url, video.play_url, video.video_url, row.preview_url),
    identityId: String(row.identity_id ?? item.identity_id ?? ''),
    identityType: String(row.identity_type ?? item.identity_type ?? ''),
    adId: String(row.ad_id ?? ''),
    videoId: String(row.video_id ?? video.video_id ?? ''),
  };
}
