import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export const META_GRAPH = 'https://graph.facebook.com/v21.0';

/** Scopes required for Messenger + Instagram DMs (no App Review beyond standard). */
export const META_OAUTH_CORE_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'instagram_manage_messages',
] as const;

/**
 * Optional comment scopes — require Meta App Review before enabling.
 * Set META_OAUTH_INCLUDE_COMMENT_SCOPES=true after approval.
 */
export const META_OAUTH_COMMENT_SCOPES = [
  'pages_read_user_content',
  'pages_manage_engagement',
  'instagram_manage_comments',
] as const;

export function resolveMetaOAuthScopes(config: { get: (key: string) => string | undefined }): string {
  const scopes = new Set<string>(META_OAUTH_CORE_SCOPES);
  if (config.get('META_OAUTH_INCLUDE_COMMENT_SCOPES') === 'true') {
    for (const scope of META_OAUTH_COMMENT_SCOPES) scopes.add(scope);
  }
  const extra = config.get('META_OAUTH_EXTRA_SCOPES')?.trim();
  if (extra) {
    for (const scope of extra.split(',').map((s) => s.trim()).filter(Boolean)) scopes.add(scope);
  }
  return [...scopes].join(',');
}

/** @deprecated Use resolveMetaOAuthScopes — kept for imports that expect a static string in tests. */
export const META_OAUTH_SCOPES = META_OAUTH_CORE_SCOPES.join(',');

export type MetaInstagramAccount = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
  instagram_business_account?: MetaInstagramAccount;
  connected_instagram_account?: { id: string; username?: string };
};

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type GraphList<T> = {
  data?: T[];
  paging?: { next?: string };
};

type BusinessRef = { id: string; name?: string };

/** Fields requested on every /me/accounts (and business page) list call. */
export const META_PAGE_LIST_FIELDS =
  'id,name,category,tasks,access_token,picture,instagram_business_account{id,username,name,profile_picture_url}';

const META_PAGE_LIST_FIELDS_FALLBACK = 'id,name,access_token,picture';

const PAGE_INSTAGRAM_FIELDS =
  'id,name,category,tasks,instagram_business_account{id,username,name,profile_picture_url}';

@Injectable()
export class MetaApiClient {
  private readonly logger = new Logger(MetaApiClient.name);
  private readonly appId?: string;
  private readonly appSecret?: string;
  private readonly oauthScopes: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('META_APP_ID');
    this.appSecret = config.get<string>('META_APP_SECRET');
    this.oauthScopes = resolveMetaOAuthScopes(config);
  }

  isConfigured() {
    return Boolean(this.appId && this.appSecret);
  }

  buildAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.appId!,
      redirect_uri: redirectUri,
      state,
      scope: this.oauthScopes,
      response_type: 'code',
      // Force permission dialog so newly added scopes (instagram_basic, etc.) are granted.
      auth_type: 'rerequest',
    });
    this.logger.log(`[Meta OAuth] authUrl scopes=${this.oauthScopes}`);
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaTokenResponse> {
    const { data } = await axios.get<MetaTokenResponse>(`${META_GRAPH}/oauth/access_token`, {
      params: {
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });
    return data;
  }

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    const { data } = await axios.get<MetaTokenResponse>(`${META_GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });
    return data;
  }

  /**
   * Fetch all Facebook Pages the user can access:
   * 1. /me/accounts (OAuth-granted pages, paginated)
   * 2. /me/businesses → owned_pages + client_pages (Business Manager, paginated)
   */
  async getPageAccounts(userAccessToken: string): Promise<MetaPageAccount[]> {
    const byId = new Map<string, MetaPageAccount>();

    const merge = (page: Partial<MetaPageAccount> & { id: string }, source: string) => {
      if (!page.id || !page.name) return;
      const existing = byId.get(page.id);
      const instagramFromList = this.pickInstagramFromPageFields(page);
      const next: MetaPageAccount = {
        id: page.id,
        name: page.name,
        access_token: page.access_token ?? existing?.access_token ?? '',
        category: page.category ?? existing?.category,
        tasks: page.tasks ?? existing?.tasks,
        picture: page.picture ?? existing?.picture,
        instagram_business_account:
          instagramFromList ?? page.instagram_business_account ?? existing?.instagram_business_account,
        connected_instagram_account:
          page.connected_instagram_account ?? existing?.connected_instagram_account,
      };
      this.logPageAudit(source, page.id, {
        pageName: page.name,
        category: page.category,
        tasks: page.tasks,
        access_token: page.access_token ? '[present]' : '[missing]',
        instagram_business_account: page.instagram_business_account ?? null,
        connected_instagram_account: page.connected_instagram_account ?? null,
        resolvedInstagram: next.instagram_business_account ?? null,
      });
      if (!existing) {
        byId.set(page.id, next);
        return;
      }
      byId.set(page.id, {
        ...existing,
        ...next,
        access_token: next.access_token || existing.access_token,
        instagram_business_account: next.instagram_business_account ?? existing.instagram_business_account,
        connected_instagram_account: next.connected_instagram_account ?? existing.connected_instagram_account,
      });
    };

    const userPages = await this.fetchUserPages(userAccessToken);
    userPages.forEach((p) => merge(p, '/me/accounts'));

    let businesses: BusinessRef[] = [];
    try {
      businesses = await this.fetchAllPages<BusinessRef>('/me/businesses', {
        fields: 'id,name',
        access_token: userAccessToken,
        limit: 100,
      });
    } catch (error) {
      this.logGraphWarning('fetchBusinesses', 'me/businesses', error);
    }

    let businessPageCount = 0;
    for (const business of businesses) {
      for (const edge of ['owned_pages', 'client_pages'] as const) {
        try {
          const bizPages = await this.fetchAllPages<MetaPageAccount>(`/${business.id}/${edge}`, {
            fields: META_PAGE_LIST_FIELDS,
            access_token: userAccessToken,
            limit: 100,
          });
          businessPageCount += bizPages.length;
          bizPages.forEach((p) => merge(p, `/${business.id}/${edge}`));
        } catch (error) {
          this.logGraphWarning(`fetchBusinessPages/${edge}`, business.id, error);
        }
      }
    }

    const resolved = await Promise.all(
      Array.from(byId.values()).map(async (page) => {
        try {
          return await this.resolvePageToken(page, userAccessToken);
        } catch (error) {
          this.logGraphWarning('resolvePageToken', page.id, error);
          return null;
        }
      }),
    );

    const withToken = resolved.filter((p): p is MetaPageAccount => Boolean(p?.access_token));

    this.logger.log(
      `[Meta pages] me/accounts=${userPages.length} businessEdges=${businessPageCount} unique=${byId.size} withToken=${withToken.length}`,
    );

    const enriched = await Promise.all(
      withToken.map((page) => this.enrichPageInstagram(page)),
    );

    const withInstagram = enriched.filter((p) => p.instagram_business_account?.id).length;
    this.logger.log(
      `[Meta pages] instagramResolved=${withInstagram} of ${enriched.length} pages with tokens`,
    );

    return enriched;
  }

  /** Resolve + enrich Instagram for a page (instagram_business_account OR connected_instagram_account). */
  private async enrichPageInstagram(page: MetaPageAccount): Promise<MetaPageAccount> {
    let ig = this.pickInstagramFromPageFields(page);

    if (!ig?.id) {
      try {
        ig = (await this.resolvePageInstagramConnection(page.id, page.access_token)) ?? undefined;
      } catch (error) {
        this.logGraphWarning('resolvePageInstagramConnection', page.id, error);
      }
    }

    if (ig?.id && !ig.username) {
      try {
        ig = await this.enrichInstagramAccount(ig.id, page.access_token, ig);
      } catch (error) {
        this.logGraphWarning('enrichInstagramAccount', page.id, error);
      }
    }

    const result = ig?.id ? { ...page, instagram_business_account: ig } : page;

    this.logPageAudit('final', page.id, {
      pageName: page.name,
      category: page.category,
      tasks: page.tasks,
      instagram_business_account: page.instagram_business_account ?? null,
      connected_instagram_account: page.connected_instagram_account ?? null,
      resolvedInstagram: result.instagram_business_account ?? null,
    });

    return result;
  }

  private pickInstagramFromPageFields(
    page: Partial<MetaPageAccount>,
  ): MetaInstagramAccount | undefined {
    if (page.instagram_business_account?.id) {
      return page.instagram_business_account;
    }
    const connected = page.connected_instagram_account;
    if (connected?.id) {
      return { id: connected.id, username: connected.username };
    }
    return undefined;
  }

  private logPageAudit(source: string, pageId: string, payload: Record<string, unknown>) {
    this.logger.log(
      `[Meta page audit] ${JSON.stringify({ source, pageId, ...payload })}`,
    );
  }

  private logGraphWarning(action: string, pageId: string, error: unknown) {
    this.logger.warn(
      JSON.stringify({
        provider: 'meta',
        action,
        pageId,
        error: this.formatGraphError(error),
      }),
    );
  }

  private formatGraphError(error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return JSON.stringify(error.response.data);
    }
    return error instanceof Error ? error.message : String(error);
  }

  toOAuthError(step: string, error: unknown): never {
    const detail = this.formatGraphError(error);
    this.logger.error(`[Meta OAuth ${step}] ${detail}`);
    const graphMessage =
      axios.isAxiosError(error) &&
      error.response?.data &&
      typeof error.response.data === 'object' &&
      error.response.data !== null &&
      'error' in error.response.data &&
      typeof (error.response.data as { error?: { message?: string } }).error?.message === 'string'
        ? (error.response.data as { error: { message: string } }).error.message
        : null;

    if (graphMessage?.includes('redirect_uri')) {
      throw new Error(
        'فشل تبادل رمز فيسبوك: رابط إعادة التوجيه غير مطابق. تأكد من إضافة https://www.chatloora.com/api/auth/meta/callback في Meta Developer Console.',
      );
    }
    if (graphMessage?.includes('authorization code has been used') || graphMessage?.includes('verification code')) {
      throw new Error('انتهت صلاحية رمز فيسبوك. أعد الربط من جديد ولا تغلق النافذة قبل اكتمال التحويل.');
    }
    throw new Error(graphMessage ?? `فشل ربط فيسبوك (${step}): ${detail}`);
  }

  /**
   * Resolve Instagram Professional account linked to a Facebook Page.
   * Checks instagram_business_account first, then connected_instagram_account (Page settings link).
   */
  async resolvePageInstagramConnection(pageId: string, pageAccessToken: string): Promise<MetaInstagramAccount | null> {
    try {
      const { data } = await axios.get<{
        id?: string;
        name?: string;
        category?: string;
        tasks?: string[];
        instagram_business_account?: MetaInstagramAccount;
        connected_instagram_account?: { id: string; username?: string };
      }>(`${META_GRAPH}/${pageId}`, {
        params: {
          fields: PAGE_INSTAGRAM_FIELDS,
          access_token: pageAccessToken,
        },
      });

      this.logPageAudit('page-detail', pageId, {
        pageName: data.name,
        category: data.category,
        tasks: data.tasks,
        instagram_business_account: data.instagram_business_account ?? null,
        connected_instagram_account: data.connected_instagram_account ?? null,
        resolvedInstagram:
          data.instagram_business_account ??
          data.connected_instagram_account ??
          null,
      });

      const picked = data.instagram_business_account ?? data.connected_instagram_account;
      if (!picked?.id) return null;

      const igBusiness = data.instagram_business_account;
      if (igBusiness?.id && igBusiness.username && igBusiness.name) {
        return igBusiness;
      }

      const seed: Partial<MetaInstagramAccount> = {
        id: picked.id,
        username: picked.username,
        name: igBusiness?.name,
        profile_picture_url: igBusiness?.profile_picture_url,
      };

      return this.enrichInstagramAccount(picked.id, pageAccessToken, seed);
    } catch (error) {
      this.logGraphWarning('resolvePageInstagramConnection', pageId, error);
      throw error;
    }
  }

  private async enrichInstagramAccount(
    igUserId: string,
    pageAccessToken: string,
    seed?: Partial<MetaInstagramAccount>,
  ): Promise<MetaInstagramAccount> {
    try {
      const { data } = await axios.get<MetaInstagramAccount & { id?: string }>(
        `${META_GRAPH}/${igUserId}`,
        {
          params: {
            fields: 'id,username,name',
            access_token: pageAccessToken,
          },
        },
      );
      return {
        id: data.id ?? igUserId,
        username: data.username ?? seed?.username,
        name: data.name ?? seed?.name,
        profile_picture_url: seed?.profile_picture_url,
      };
    } catch (error) {
      this.logGraphWarning('enrichInstagramAccount', igUserId, error);
      return { id: igUserId, username: seed?.username, name: seed?.name };
    }
  }

  /** @deprecated Use resolvePageInstagramConnection */
  async getLinkedInstagramAccount(pageId: string, pageAccessToken: string) {
    return this.resolvePageInstagramConnection(pageId, pageAccessToken);
  }

  private async resolvePageToken(
    page: MetaPageAccount,
    userAccessToken: string,
  ): Promise<MetaPageAccount | null> {
    if (page.access_token) return page;
    try {
      const { data } = await axios.get<{ access_token?: string; name?: string }>(
        `${META_GRAPH}/${page.id}`,
        { params: { fields: 'access_token,name', access_token: userAccessToken } },
      );
      if (!data.access_token) {
        this.logGraphWarning('resolvePageToken/missingToken', page.id, { message: 'No access_token in response' });
        return null;
      }
      return {
        ...page,
        name: data.name ?? page.name,
        access_token: data.access_token,
      };
    } catch (error) {
      this.logGraphWarning('resolvePageToken', page.id, error);
      return null;
    }
  }

  private async fetchUserPages(userAccessToken: string): Promise<MetaPageAccount[]> {
    try {
      return await this.fetchAllPages<MetaPageAccount>('/me/accounts', {
        fields: META_PAGE_LIST_FIELDS,
        access_token: userAccessToken,
        limit: 100,
      });
    } catch (error) {
      this.logGraphWarning('fetchUserPages/fullFields', 'me/accounts', error);
      return this.fetchAllPages<MetaPageAccount>('/me/accounts', {
        fields: META_PAGE_LIST_FIELDS_FALLBACK,
        access_token: userAccessToken,
        limit: 100,
      });
    }
  }

  private async fetchAllPages<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
    const items: T[] = [];
    let nextUrl: string | null = null;

    const first = await axios.get<GraphList<T>>(`${META_GRAPH}${path}`, { params });
    items.push(...(first.data.data ?? []));
    nextUrl = first.data.paging?.next ?? null;

    while (nextUrl) {
      const { data } = await axios.get<GraphList<T>>(nextUrl);
      items.push(...(data.data ?? []));
      nextUrl = data.paging?.next ?? null;
    }

    return items;
  }


  async subscribePageToWebhooks(pageId: string, pageAccessToken: string) {
    try {
      await axios.post(`${META_GRAPH}/${pageId}/subscribed_apps`, null, {
        params: {
          // `messages` covers Messenger + Instagram DMs on the linked Page.
          subscribed_fields: 'messages,messaging_postbacks,message_echoes,message_reads,messaging_handovers,feed',
          access_token: pageAccessToken,
        },
      });
      this.logger.log(`[Meta page webhook] subscribed pageId=${pageId}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const detail = JSON.stringify(error.response.data);
        throw new Error(`${error.message} — ${detail}`);
      }
      throw error;
    }
  }

  /**
   * Register app-level webhooks for Messenger (page) and Instagram DMs (instagram object).
   * Page-level subscribed_apps alone is not enough — the app must subscribe at app level.
   */
  async ensureAppWebhookSubscription(callbackUrl: string, verifyToken: string) {
    if (!this.isConfigured()) {
      return { page: { ok: false, reason: 'not_configured' }, instagram: { ok: false, reason: 'not_configured' } };
    }

    const page = await this.subscribeAppObject(
      'page',
      callbackUrl,
      verifyToken,
      'messages,messaging_postbacks,message_echoes,message_reads,messaging_handovers,feed',
    );
    const instagram = await this.subscribeAppObject(
      'instagram',
      callbackUrl,
      verifyToken,
      'messages,messaging_postbacks,messaging_seen,messaging_handover,message_reactions,comments',
    );
    return { page, instagram };
  }

  private async subscribeAppObject(
    object: 'page' | 'instagram',
    callbackUrl: string,
    verifyToken: string,
    fields: string,
  ) {
    const attempts = object === 'instagram' ? [fields, 'messages'] : [fields];
    let lastReason = 'unknown';

    for (const attemptFields of attempts) {
      try {
        const { data } = await axios.post<{ success?: boolean }>(
          `${META_GRAPH}/${this.appId}/subscriptions`,
          null,
          {
            params: {
              object,
              callback_url: callbackUrl,
              verify_token: verifyToken,
              fields: attemptFields,
              include_values: 'true',
              access_token: `${this.appId}|${this.appSecret}`,
            },
          },
        );
        this.logger.log(
          `[Meta app webhook] object=${object} fields=${attemptFields} callback=${callbackUrl} success=${Boolean(data.success)}`,
        );
        return { ok: Boolean(data.success), fields: attemptFields };
      } catch (error) {
        lastReason = this.formatGraphError(error);
        this.logger.warn(
          `[Meta app webhook] object=${object} fields=${attemptFields} subscription failed: ${lastReason}`,
        );
      }
    }

    return { ok: false, reason: lastReason };
  }

  async debugTokenScopes(accessToken: string) {
    if (!this.isConfigured()) return null;
    try {
      const { data } = await axios.get<{
        data?: { scopes?: string[]; is_valid?: boolean; type?: string; profile_id?: string };
      }>(`${META_GRAPH}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${this.appId}|${this.appSecret}`,
        },
      });
      return data.data ?? null;
    } catch (error) {
      this.logger.warn(`[Meta debug_token] failed: ${this.formatGraphError(error)}`);
      return null;
    }
  }

  async inspectInstagramAccess(pageId: string, pageAccessToken: string) {
    const debug = await this.debugTokenScopes(pageAccessToken);
    const scopes = debug?.scopes ?? [];
    const missing = ['instagram_manage_messages', 'instagram_basic', 'pages_messaging', 'pages_manage_metadata'].filter(
      (scope) => !scopes.includes(scope),
    );

    let conversationsError: string | null = null;
    let conversationsErrorCode: number | null = null;
    let conversationCount: number | null = null;
    try {
      const { data } = await axios.get<{ data?: unknown[] }>(`${META_GRAPH}/${pageId}/conversations`, {
        params: {
          platform: 'instagram',
          limit: 25,
          fields: 'updated_time',
          access_token: pageAccessToken,
        },
        timeout: 60000,
      });
      conversationCount = (data.data ?? []).length;
    } catch (error) {
      conversationsError = this.formatGraphError(error);
      if (axios.isAxiosError(error)) {
        conversationsErrorCode = (error.response?.data as { error?: { error_subcode?: number } })?.error?.error_subcode ?? null;
      }
    }

    const instagramMessagesDisabled = conversationsErrorCode === 2534041;
    const emptyInbox = conversationCount === 0 && !conversationsError;

    return {
      tokenValid: Boolean(debug?.is_valid),
      scopes,
      missingScopes: missing,
      conversationCount,
      conversationsError,
      conversationsErrorCode,
      instagramMessagesDisabled,
      emptyInbox,
      likelyNeedsAdvancedAccess: emptyInbox && missing.length === 0,
      needsReconnect: missing.length > 0 || Boolean(conversationsError),
    };
  }

  async validatePage(pageId: string, pageAccessToken: string) {
    const { data } = await axios.get<{ id: string; name?: string }>(`${META_GRAPH}/${pageId}`, {
      params: { fields: 'id,name', access_token: pageAccessToken },
    });
    return data;
  }

  /** Pull recent threads via Graph API (Messenger or Instagram DMs via linked Page). */
  async fetchPageConversations(
    pageId: string,
    pageAccessToken: string,
    limit = 25,
    platform?: 'instagram' | 'messenger',
  ) {
    type ThreadMessage = {
      id: string;
      message?: string;
      created_time?: string;
      from?: { id: string; name?: string };
      attachments?: { data?: unknown[] };
      sticker_id?: number;
    };
    type Thread = {
      id: string;
      participants?: { data?: Array<{ id: string; name?: string }> };
      messages?: { data?: ThreadMessage[]; paging?: { next?: string } };
    };

    const threads: Thread[] = [];
    let nextUrl: string | null = `${META_GRAPH}/${pageId}/conversations`;
    const attachmentFields = 'attachments{type,mime_type,name,file_url,image_data,payload},sticker{id,url,image_url}';
    const firstParams = {
      fields: `participants,messages.limit(25){id,message,from,created_time,sticker_id,${attachmentFields}}`,
      limit,
      access_token: pageAccessToken,
      ...(platform ? { platform } : {}),
    };

    for (let page = 0; page < 10 && nextUrl; page++) {
      type GraphPage = { data?: Thread[]; paging?: { next?: string } };
      let batch: GraphPage;
      try {
        if (page === 0) {
          batch = (await axios.get<GraphPage>(nextUrl, { params: firstParams })).data;
        } else {
          batch = (await axios.get<GraphPage>(nextUrl)).data;
        }
      } catch (error) {
        throw new Error(this.formatGraphError(error));
      }
      threads.push(...(batch.data ?? []));
      nextUrl = batch.paging?.next ?? null;
    }

    return threads;
  }

  /** Fetch all messages in a Messenger thread (paginated). */
  async fetchThreadMessages(threadId: string, pageAccessToken: string, limit = 100) {
    type ThreadMessage = {
      id: string;
      message?: string;
      created_time?: string;
      from?: { id: string; name?: string };
      attachments?: { data?: unknown[] };
      sticker_id?: number;
    };

    const messages: ThreadMessage[] = [];
    let nextUrl: string | null = `${META_GRAPH}/${threadId}/messages`;
    const attachmentFields = 'attachments{type,mime_type,name,file_url,image_data,payload},sticker{id,url,image_url}';
    const firstParams = {
      fields: `id,message,from,created_time,sticker_id,${attachmentFields}`,
      limit,
      access_token: pageAccessToken,
    };

    for (let page = 0; page < 20 && nextUrl; page++) {
      type GraphPage = { data?: ThreadMessage[]; paging?: { next?: string } };
      let batch: GraphPage;
      if (page === 0) {
        batch = (await axios.get<GraphPage>(nextUrl, { params: firstParams })).data;
      } else {
        batch = (await axios.get<GraphPage>(nextUrl)).data;
      }
      messages.push(...(batch.data ?? []));
      nextUrl = batch.paging?.next ?? null;
    }

    return messages;
  }

  /** Recent Instagram media for a connected IG business account. */
  async fetchInstagramMedia(instagramAccountId: string, pageAccessToken: string, limit = 15) {
    type MediaItem = { id: string; caption?: string; comments_count?: number; timestamp?: string };
    const { data } = await axios.get<{ data?: MediaItem[] }>(`${META_GRAPH}/${instagramAccountId}/media`, {
      params: {
        fields: 'id,caption,comments_count,timestamp',
        limit,
        access_token: pageAccessToken,
      },
    });
    return data.data ?? [];
  }

  /** Comments on an Instagram media object (includes public replies). */
  async fetchInstagramMediaComments(mediaId: string, pageAccessToken: string, limit = 50) {
    type CommentItem = {
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
      from?: { id: string; username?: string; name?: string };
      replies?: {
        data?: Array<{
          id: string;
          text?: string;
          timestamp?: string;
          username?: string;
          from?: { id: string; username?: string };
        }>;
      };
    };
    const fullFields =
      'id,text,username,timestamp,from{id,username},replies{id,text,timestamp,username,from{id,username}}';
    const simpleFields = 'id,text,username,timestamp,from{id,username}';
    try {
      const { data } = await axios.get<{ data?: CommentItem[] }>(`${META_GRAPH}/${mediaId}/comments`, {
        params: { fields: fullFields, limit, access_token: pageAccessToken },
      });
      return data.data ?? [];
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 400) throw error;
      this.logGraphWarning('fetchInstagramMediaComments/fullFields', mediaId, error);
      const { data } = await axios.get<{ data?: CommentItem[] }>(`${META_GRAPH}/${mediaId}/comments`, {
        params: { fields: simpleFields, limit, access_token: pageAccessToken },
      });
      return data.data ?? [];
    }
  }

  isGraphRateLimitError(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    const code = (error.response?.data as { error?: { code?: number } } | undefined)?.error?.code;
    return code === 80002 || code === 4 || code === 17 || code === 32;
  }

  graphErrorMessage(error: unknown) {
    return this.formatGraphError(error);
  }

  /** Recent Facebook Page posts (for comment polling when feed webhooks are missing). */
  async fetchFacebookPagePosts(pageId: string, pageAccessToken: string, limit = 15) {
    type PostItem = { id: string; message?: string; created_time?: string };
    const { data } = await axios.get<{ data?: PostItem[] }>(`${META_GRAPH}/${pageId}/posts`, {
      params: {
        fields: 'id,message,created_time',
        limit,
        access_token: pageAccessToken,
      },
    });
    return data.data ?? [];
  }

  /** Top-level comments on a Facebook Page post (includes nested replies). */
  async fetchFacebookPostComments(postId: string, pageAccessToken: string, limit = 50) {
    type CommentItem = {
      id: string;
      message?: string;
      created_time?: string;
      from?: { id: string; name?: string };
      comments?: { data?: CommentItem[] };
    };
    const { data } = await axios.get<{ data?: CommentItem[] }>(`${META_GRAPH}/${postId}/comments`, {
      params: {
        fields: 'id,message,created_time,from{id,name},comments{id,message,created_time,from{id,name}}',
        limit,
        access_token: pageAccessToken,
      },
    });
    return data.data ?? [];
  }
}
