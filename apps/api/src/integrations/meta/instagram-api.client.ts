import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export const INSTAGRAM_GRAPH = 'https://graph.instagram.com/v21.0';

export type InstagramMe = {
  id: string;
  user_id?: string;
  username?: string;
};

@Injectable()
export class InstagramApiClient {
  private readonly logger = new Logger(InstagramApiClient.name);
  private readonly appId?: string;
  private readonly appSecret?: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('INSTAGRAM_API_APP_ID')?.trim();
    this.appSecret = config.get<string>('INSTAGRAM_API_APP_SECRET')?.trim();
  }

  isConfigured() {
    return Boolean(this.appId && this.appSecret);
  }

  getAppId() {
    return this.appId ?? null;
  }

  getAppSecret() {
    return this.appSecret ?? null;
  }

  async getMe(accessToken: string): Promise<InstagramMe> {
    const { data } = await axios.get<InstagramMe>(`${INSTAGRAM_GRAPH}/me`, {
      params: { fields: 'id,user_id,username', access_token: accessToken },
      timeout: 30000,
    });
    if (!data?.id) throw new Error('Instagram token did not return account id');
    return data;
  }

  /**
   * Instagram API with Instagram Login — enable webhooks for this professional account.
   * @see https://developers.facebook.com/docs/instagram-platform/webhooks
   */
  async subscribeWebhooks(accessToken: string, fields = 'comments,messages') {
    const { data } = await axios.post<{ success?: boolean }>(
      `${INSTAGRAM_GRAPH}/me/subscribed_apps`,
      null,
      {
        params: { subscribed_fields: fields, access_token: accessToken },
        timeout: 30000,
      },
    );
    this.logger.log(`[Instagram API] subscribed_apps fields=${fields} success=${Boolean(data?.success)}`);
    return data;
  }

  async listSubscriptions(accessToken: string) {
    const { data } = await axios.get(`${INSTAGRAM_GRAPH}/me/subscribed_apps`, {
      params: { access_token: accessToken },
      timeout: 30000,
    });
    return data;
  }

  async ensureAppWebhook(callbackUrl: string, verifyToken: string) {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'INSTAGRAM_API_APP_ID / INSTAGRAM_API_APP_SECRET not set' };
    }
    try {
      const { data } = await axios.post<{ success?: boolean }>(
        `https://graph.facebook.com/v21.0/${this.appId}/subscriptions`,
        null,
        {
          params: {
            object: 'instagram',
            callback_url: callbackUrl,
            verify_token: verifyToken,
            fields: 'comments,messages,messaging_seen,message_reactions',
            access_token: `${this.appId}|${this.appSecret}`,
          },
          timeout: 30000,
        },
      );
      return { ok: Boolean(data?.success), raw: data };
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data : String(error);
      this.logger.warn(`[Instagram API app webhook] failed: ${JSON.stringify(detail)}`);
      return { ok: false, reason: detail };
    }
  }
}
