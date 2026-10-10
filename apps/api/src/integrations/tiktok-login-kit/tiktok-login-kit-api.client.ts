import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

/** Official Login Kit v2 endpoints — https://developers.tiktok.com/doc/login-kit-web */
export const TIKTOK_LOGIN_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_LOGIN_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_LOGIN_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

/** Official Login Kit web example scope — https://developers.tiktok.com/doc/login-kit-web */
export const TIKTOK_LOGIN_KIT_SCOPE = 'user.info.basic';

export type TikTokLoginTokenResponse = {
  access_token: string;
  refresh_token?: string;
  open_id: string;
  expires_in: number;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type TikTokLoginUserInfo = {
  open_id: string;
  display_name?: string;
  avatar_url?: string;
};

@Injectable()
export class TikTokLoginApiClient {
  private readonly logger = new Logger(TikTokLoginApiClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ timeout: 30_000 });
  }

  buildAuthorizeUrl(input: {
    clientKey: string;
    redirectUri: string;
    state: string;
    scopes?: string;
  }): string {
    const scope = input.scopes ?? TIKTOK_LOGIN_KIT_SCOPE;
    const params = new URLSearchParams({
      client_key: input.clientKey,
      response_type: 'code',
      scope,
      redirect_uri: input.redirectUri,
      state: input.state,
    });
    const url = `${TIKTOK_LOGIN_AUTHORIZE_URL}?${params.toString()}`;
    this.logger.log(
      `[OAuth authorize URL built] endpoint=${TIKTOK_LOGIN_AUTHORIZE_URL} client_key=${input.clientKey} response_type=code scope=${scope} redirect_uri=${input.redirectUri} state=${input.state} full_url=${url}`,
    );
    return url;
  }

  async exchangeCode(input: {
    clientKey: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<TikTokLoginTokenResponse> {
    const body = new URLSearchParams({
      client_key: input.clientKey,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    });

    this.logger.log(
      `[OAuth token REQUEST] POST ${TIKTOK_LOGIN_TOKEN_URL} client_key=${input.clientKey} redirect_uri=${input.redirectUri} grant_type=authorization_code`,
    );

    try {
      const response = await this.http.post(TIKTOK_LOGIN_TOKEN_URL, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
        validateStatus: () => true,
      });

      this.logger.log(
        `[OAuth token RESPONSE] status=${response.status} body=${JSON.stringify(response.data)}`,
      );

      const data = this.unwrapTokenPayload(response.data);
      if (data.error) {
        const msg = `${data.error}: ${data.error_description ?? 'no description'} (log_id=${data.log_id ?? 'n/a'})`;
        this.logger.error(`[OAuth token ERROR] ${msg}`);
        throw new BadRequestException(
          data.error === 'invalid_client'
            ? 'TikTok Client Key or Client Secret is incorrect. Copy fresh Sandbox credentials from developers.tiktok.com and update server .env.'
            : msg,
        );
      }
      if (response.status >= 400) {
        throw new BadRequestException(`TikTok token HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!data.access_token || !data.open_id) {
        throw new BadRequestException(`TikTok token response missing access_token/open_id: ${JSON.stringify(response.data)}`);
      }
      return data as TikTokLoginTokenResponse;
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        this.logger.error(
          `[OAuth token AXIOS ERROR] status=${err.response.status} body=${JSON.stringify(err.response.data)}`,
        );
      }
      throw err;
    }
  }

  async refreshToken(input: {
    clientKey: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<TikTokLoginTokenResponse> {
    const body = new URLSearchParams({
      client_key: input.clientKey,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
    });
    this.logger.log(`[OAuth refresh REQUEST] POST ${TIKTOK_LOGIN_TOKEN_URL} body=${body.toString()}`);
    const response = await this.http.post(TIKTOK_LOGIN_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      validateStatus: () => true,
    });
    this.logger.log(
      `[OAuth refresh RESPONSE] status=${response.status} body=${JSON.stringify(response.data)}`,
    );
    const data = this.unwrapTokenPayload(response.data);
    if (data.error) {
      throw new Error(String(data.error_description ?? data.error));
    }
    return data as TikTokLoginTokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<TikTokLoginUserInfo> {
    const fields = 'open_id,display_name,avatar_url';
    const url = `${TIKTOK_LOGIN_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
    this.logger.log(`[OAuth user/info REQUEST] GET ${url} Authorization=Bearer ${accessToken}`);

    const response = await this.http.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
    });

    this.logger.log(
      `[OAuth user/info RESPONSE] status=${response.status} body=${JSON.stringify(response.data)}`,
    );

    const data = response.data;
    if (data.error?.code && data.error.code !== 'ok') {
      throw new Error(
        `TikTok user info error: ${data.error.message ?? data.error.code} (log_id=${data.error.log_id ?? 'n/a'})`,
      );
    }
    if (response.status >= 400) {
      throw new Error(`TikTok user info HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }
    const user = data.data?.user as TikTokLoginUserInfo | undefined;
    if (!user?.open_id) {
      throw new Error(`TikTok user info missing open_id: ${JSON.stringify(response.data)}`);
    }
    return user;
  }

  /** TikTok may return flat JSON or legacy { data: {...} } wrapper. */
  private unwrapTokenPayload(raw: Record<string, unknown>): Record<string, unknown> {
    if (raw.error) return raw;
    const nested = raw.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
    return raw;
  }
}

/** @deprecated Use TikTokLoginApiClient */
export const TikTokLoginKitApiClient = TikTokLoginApiClient;
