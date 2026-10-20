import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelProvider, ChannelPurpose, ChannelStatus, WhatsAppCloudAccountStatus } from '@watsapp/database';
import axios from 'axios';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';

const META_GRAPH = 'https://graph.facebook.com/v21.0';

export type CreateWhatsAppCloudAccountInput = {
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken?: string;
  businessId?: string;
  aiAgentId?: string;
  defaultInboxLabel?: string;
};

@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  list(teamId: string) {
    return this.prisma.whatsAppCloudAccount.findMany({
      where: { teamId },
      include: {
        aiAgent: { select: { id: true, name: true, type: true } },
        business: { select: { id: true, name: true } },
        channel: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map((row) => this.toPublicAccount(row)));
  }

  private toPublicAccount<T extends { encryptedAccessToken?: string; encryptedVerifyToken?: string | null; metadata?: unknown }>(
    row: T,
  ) {
    const { encryptedAccessToken, encryptedVerifyToken, ...safe } = row;
    const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
    return {
      ...safe,
      hasAccessToken: Boolean(encryptedAccessToken),
      webhookStatus: typeof meta.webhookStatus === 'string' ? meta.webhookStatus : meta.webhookSubscribed ? 'subscribed' : 'unknown',
    };
  }

  async create(teamId: string, input: CreateWhatsAppCloudAccountInput) {
    const existingCheck = await this.prisma.whatsAppCloudAccount.findUnique({
      where: { teamId_phoneNumberId: { teamId, phoneNumberId: input.phoneNumberId } },
    });
    if (!existingCheck) await this.entitlements.assertWhatsappCloudConnect(teamId);
    await this.validateToken(input.phoneNumberId, input.accessToken);
    await this.subscribeWabaToApp(input.wabaId, input.accessToken);

    const existing = await this.prisma.whatsAppCloudAccount.findUnique({
      where: { teamId_phoneNumberId: { teamId, phoneNumberId: input.phoneNumberId } },
      include: { channel: true },
    });

    if (existing) {
      await this.prisma.whatsAppCloudAccount.update({
        where: { id: existing.id },
        data: {
          businessId: input.businessId,
          aiAgentId: input.aiAgentId,
          name: input.name,
          phoneNumber: input.phoneNumber,
          wabaId: input.wabaId,
          encryptedAccessToken: this.encryption.encryptJson(input.accessToken),
          encryptedVerifyToken: input.verifyToken ? this.encryption.encryptJson(input.verifyToken) : null,
          defaultInboxLabel: input.defaultInboxLabel,
          status: WhatsAppCloudAccountStatus.CONNECTED,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          failureReason: null,
          metadata: { source: 'manual_credentials' },
        },
      });
      let channelId = existing.channel?.id ?? null;
      if (existing.channel) {
        await this.prisma.channel.update({
          where: { id: existing.channel.id },
          data: {
            name: input.name,
            status: ChannelStatus.CONNECTED,
            externalId: input.phoneNumberId,
            aiAgentId: input.aiAgentId,
            businessId: input.businessId,
            lastSeenAt: new Date(),
            metadata: {
              phoneNumber: input.phoneNumber,
              wabaId: input.wabaId,
              accountType: 'cloud_api',
              source: 'manual_credentials',
            },
          },
        });
      } else {
        const channel = await this.prisma.channel.create({
          data: {
            teamId,
            businessId: input.businessId,
            provider: ChannelProvider.WHATSAPP_CLOUD,
            purpose: ChannelPurpose.INBOX,
            name: input.name,
            status: ChannelStatus.CONNECTED,
            externalId: input.phoneNumberId,
            aiAgentId: input.aiAgentId,
            whatsAppCloudAccountId: existing.id,
            lastSeenAt: new Date(),
            metadata: {
              phoneNumber: input.phoneNumber,
              wabaId: input.wabaId,
              accountType: 'cloud_api',
              source: 'manual_credentials',
            },
          },
        });
        channelId = channel.id;
      }
      const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: existing.id } });
      this.logger.log(`[WA cloud] reconnected team=${teamId} phone_number_id=${input.phoneNumberId}`);
      return { account: account ? this.toPublicAccount(account) : account, channelId, reconnected: true };
    }

    const account = await this.prisma.whatsAppCloudAccount.create({
      data: {
        teamId,
        businessId: input.businessId,
        aiAgentId: input.aiAgentId,
        name: input.name,
        phoneNumber: input.phoneNumber,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        encryptedAccessToken: this.encryption.encryptJson(input.accessToken),
        encryptedVerifyToken: input.verifyToken ? this.encryption.encryptJson(input.verifyToken) : null,
        defaultInboxLabel: input.defaultInboxLabel,
        status: WhatsAppCloudAccountStatus.CONNECTED,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        metadata: { source: 'manual_credentials' },
      },
    });

    const channel = await this.prisma.channel.create({
      data: {
        teamId,
        businessId: input.businessId,
        provider: ChannelProvider.WHATSAPP_CLOUD,
        purpose: ChannelPurpose.INBOX,
        name: input.name,
        status: ChannelStatus.CONNECTED,
        externalId: input.phoneNumberId,
        aiAgentId: input.aiAgentId,
        whatsAppCloudAccountId: account.id,
        lastSeenAt: new Date(),
        metadata: {
          phoneNumber: input.phoneNumber,
          wabaId: input.wabaId,
          accountType: 'cloud_api',
          source: 'manual_credentials',
        },
      },
    });

    this.logger.log(`[WA cloud] connected team=${teamId} phone_number_id=${input.phoneNumberId}`);
    return { account: this.toPublicAccount(account), channelId: channel.id, reconnected: false };
  }

  async assignAiAgent(teamId: string, accountId: string, aiAgentId: string | null) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: accountId, teamId },
      include: { channel: true },
    });
    if (!account) throw new NotFoundException('WhatsApp account not found');

    await this.prisma.whatsAppCloudAccount.update({ where: { id: accountId }, data: { aiAgentId } });
    const channel = account.channel ?? await this.prisma.channel.findFirst({ where: { whatsAppCloudAccountId: accountId } });
    if (channel) {
      await this.prisma.channel.update({ where: { id: channel.id }, data: { aiAgentId } });
    }
    return { ok: true };
  }

  async getAccessToken(accountId: string): Promise<string | null> {
    const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: accountId } });
    if (!account?.encryptedAccessToken) return null;
    return this.encryption.decryptJson<string>(account.encryptedAccessToken);
  }

  async disconnect(teamId: string, accountId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: accountId, teamId },
      include: { channel: true },
    });
    if (!account) throw new NotFoundException('WhatsApp account not found');

    await this.prisma.whatsAppCloudAccount.update({
      where: { id: accountId },
      data: {
        status: WhatsAppCloudAccountStatus.DISCONNECTED,
        encryptedAccessToken: '',
        failureReason: null,
      },
    });
    if (account.channel) {
      await this.prisma.channel.update({
        where: { id: account.channel.id },
        data: { status: ChannelStatus.DISCONNECTED },
      });
    }
    return { disconnected: true };
  }

  /** Embedded Signup popup URL (LaunchBridge — does not require JSSDK). */
  getEmbeddedSignupConfig() {
    const appId = this.config.get<string>('META_APP_ID')?.trim() || '1519180079681851';
    const configId = this.config.get<string>('META_WA_EMBEDDED_CONFIG_ID')?.trim() || '2804512506595427';
    const webUrl = this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') || 'https://www.chatloora.com';
    const redirectUri = `${webUrl}/whatsapp/embedded-callback`;
    const extras = encodeURIComponent(JSON.stringify({ setup: {}, sessionInfoVersion: '3', version: 'v4' }));
    const scope = encodeURIComponent('whatsapp_business_messaging,whatsapp_business_management');
    const onboardUrl =
      `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}` +
      `&config_id=${configId}&response_type=code&scope=${scope}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&extras=${extras}`;
    return { appId, configId, onboardUrl, redirectUri, graphVersion: 'v21.0' };
  }

  /**
   * Complete Meta WhatsApp Embedded Signup: exchange code → long-lived token → save WABA + phone_number_id.
   */
  async connectEmbeddedSignup(
    teamId: string,
    input: { code: string; wabaId?: string; phoneNumberId?: string; businessId?: string; name?: string },
  ) {
    await this.entitlements.assertWhatsappApi(teamId);
    const code = input.code?.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }

    const accessToken = await this.exchangeEmbeddedSignupCode(code);
    let wabaId = input.wabaId?.trim() || '';
    let phoneNumberId = input.phoneNumberId?.trim() || '';

    if (!wabaId || !phoneNumberId) {
      const discovered = await this.discoverEmbeddedAssets(accessToken);
      wabaId = wabaId || discovered.wabaId;
      phoneNumberId = phoneNumberId || discovered.phoneNumberId;
    }

    if (!wabaId) {
      throw new BadRequestException('Could not determine WhatsApp Business Account (WABA) ID');
    }
    phoneNumberId = await this.resolveEmbeddedPhoneNumberId(wabaId, accessToken, phoneNumberId || undefined);
    let phoneMeta: { display_phone_number?: string; verified_name?: string } = {};
    try {
      phoneMeta = await this.fetchPhoneNumberMeta(phoneNumberId, accessToken);
    } catch (error) {
      this.logger.warn(
        `[WA embedded signup] phone meta unavailable id=${phoneNumberId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const phoneNumber = phoneMeta.display_phone_number ?? phoneNumberId;
    const name = input.name?.trim() || phoneMeta.verified_name || phoneNumber;

    await this.subscribeWabaToApp(wabaId, accessToken);

    const existing = await this.prisma.whatsAppCloudAccount.findUnique({
      where: { teamId_phoneNumberId: { teamId, phoneNumberId } },
      include: { channel: true },
    });

    if (existing) {
      await this.prisma.whatsAppCloudAccount.update({
        where: { id: existing.id },
        data: {
          wabaId,
          name,
          phoneNumber,
          encryptedAccessToken: this.encryption.encryptJson(accessToken),
          status: WhatsAppCloudAccountStatus.CONNECTED,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          failureReason: null,
          metadata: { source: 'embedded_signup', businessId: input.businessId ?? null },
        },
      });
      if (existing.channel) {
        await this.prisma.channel.update({
          where: { id: existing.channel.id },
          data: {
            name,
            status: ChannelStatus.CONNECTED,
            purpose: ChannelPurpose.INBOX,
            externalId: phoneNumberId,
            lastSeenAt: new Date(),
            metadata: {
              phoneNumber,
              wabaId,
              accountType: 'cloud_api',
              source: 'embedded_signup',
            },
          },
        });
      } else {
        const createdChannel = await this.prisma.channel.create({
          data: {
            teamId,
            businessId: input.businessId,
            provider: ChannelProvider.WHATSAPP_CLOUD,
            purpose: ChannelPurpose.INBOX,
            name,
            status: ChannelStatus.CONNECTED,
            externalId: phoneNumberId,
            whatsAppCloudAccountId: existing.id,
            lastSeenAt: new Date(),
            metadata: { phoneNumber, wabaId, accountType: 'cloud_api', source: 'embedded_signup' },
          },
        });
        const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: existing.id } });
        this.logger.log(`[WA embedded signup] reconnected team=${teamId} phone_number_id=${phoneNumberId}`);
        return { account: account ? this.toPublicAccount(account) : account, channelId: createdChannel.id, reconnected: true };
      }
      const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: existing.id } });
      this.logger.log(`[WA embedded signup] reconnected team=${teamId} phone_number_id=${phoneNumberId}`);
      return { account: account ? this.toPublicAccount(account) : account, channelId: existing.channel?.id ?? null, reconnected: true };
    }

    const created = await this.create(teamId, {
      name,
      phoneNumber,
      phoneNumberId,
      wabaId,
      accessToken,
      businessId: input.businessId,
    });
    this.logger.log(`[WA embedded signup] connected team=${teamId} phone_number_id=${phoneNumberId}`);
    return { ...created, reconnected: false };
  }

  /**
   * Complete a customer Cloud API connection after Meta shared a WABA.
   * Requires the customer's own access token — never the Chatloora official sender token.
   */
  async connectSharedWaba(
    teamId: string,
    input: { wabaId?: string; phoneNumberId?: string; businessId?: string; name?: string; accessToken?: string },
  ) {
    const customerToken = input.accessToken?.trim();
    if (!customerToken) {
      throw new BadRequestException({
        message: 'Customer WhatsApp cannot use Chatloora official sender credentials',
        hint: 'Finish Meta Embedded Signup until an OAuth code is returned, or paste your own Cloud API access token from Meta → WhatsApp → API Setup.',
      });
    }
    await this.entitlements.assertWhatsappCloudConnect(teamId);
    let wabaId = input.wabaId?.trim() || '';
    let phoneNumberId = input.phoneNumberId?.trim() || '';

    if (wabaId && !/^\d{10,20}$/.test(wabaId)) {
      throw new BadRequestException('wabaId must be numeric when provided');
    }
    if (phoneNumberId && !/^\d{10,20}$/.test(phoneNumberId)) {
      throw new BadRequestException('phoneNumberId must be numeric when provided');
    }

    if (!wabaId || !phoneNumberId) {
      const discovered = await this.discoverEmbeddedAssets(customerToken);
      wabaId = wabaId || discovered.wabaId;
      phoneNumberId = phoneNumberId || discovered.phoneNumberId;
    }

    if (!wabaId) {
      throw new BadRequestException({
        message: 'No WhatsApp Business account found for this customer token',
        hint: 'Complete Meta linking, then retry. Or use manual Cloud API credentials from API Setup.',
      });
    }

    await this.validateToken(phoneNumberId, customerToken);
    await this.subscribeWabaToApp(wabaId, customerToken);

    const phoneMeta = await this.fetchPhoneNumberMeta(phoneNumberId, customerToken);
    const phoneNumber = phoneMeta.display_phone_number ?? phoneNumberId;
    const name = input.name?.trim() || phoneMeta.verified_name || phoneNumber;

    const existing = await this.prisma.whatsAppCloudAccount.findUnique({
      where: { teamId_phoneNumberId: { teamId, phoneNumberId } },
      include: { channel: true },
    });

    if (existing) {
      await this.prisma.whatsAppCloudAccount.update({
        where: { id: existing.id },
        data: {
          wabaId,
          name,
          phoneNumber,
          encryptedAccessToken: this.encryption.encryptJson(customerToken),
          status: WhatsAppCloudAccountStatus.CONNECTED,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          failureReason: null,
          metadata: { source: 'customer_token', webhookStatus: 'subscribed', businessId: input.businessId ?? null },
        },
      });
      if (existing.channel) {
        await this.prisma.channel.update({
          where: { id: existing.channel.id },
          data: {
            name,
            status: ChannelStatus.CONNECTED,
            purpose: ChannelPurpose.INBOX,
            externalId: phoneNumberId,
            lastSeenAt: new Date(),
            metadata: { phoneNumber, wabaId, accountType: 'cloud_api', source: 'customer_token' },
          },
        });
      }
      const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: existing.id } });
      this.logger.log(`[WA customer] reconnected team=${teamId} phone_number_id=${phoneNumberId}`);
      return { account: account ? this.toPublicAccount(account) : account, channelId: existing.channel?.id ?? null, reconnected: true };
    }

    const created = await this.create(teamId, {
      name,
      phoneNumber,
      phoneNumberId,
      wabaId,
      accessToken: customerToken,
      businessId: input.businessId,
    });
    this.logger.log(`[WA customer] connected team=${teamId} phone_number_id=${phoneNumberId}`);
    return { ...created, reconnected: false };
  }

  private credentialValidationError(detail: unknown): BadRequestException {
    const text = JSON.stringify(detail ?? '');
    if (text.includes('Session has expired') || text.includes('"code":190') || text.includes('"error_subcode":463')) {
      return new BadRequestException({
        message: 'الرمز الذي أدخلته منتهٍ أو غير صالح',
        hint:
          'من صفحة Meta → WhatsApp → إعداد واجهة API اضغط «إنشاء رمز وصول» ثم الصقه فوراً في النموذج واضغط حفظ. رمز الاختبار ينتهي خلال ساعات. للإنتاج استخدم Permanent Token من System User.',
        detail,
      });
    }
    if (text.includes('error_subcode":33') || text.includes('Unsupported get request')) {
      return new BadRequestException({
        message: 'الرمز لا يملك صلاحية على رقم الهاتف هذا',
        hint:
          'تأكد أن Phone Number ID و WABA ID من نفس صفحة API Setup التي أنشأت منها الرمز، وأن الرقم ظاهر في القائمة المنسدلة «من».',
        detail,
      });
    }
    return new BadRequestException({
      message: 'بيانات واتساب Cloud API غير صحيحة',
      hint:
        'Phone Number ID يجب أن يكون رقماً من API Setup، والرمز من نفس التطبيق ونفس الرقم.',
      detail,
    });
  }

  private assertTokenNotExpired(detail: unknown) {
    const text = JSON.stringify(detail ?? '');
    if (text.includes('Session has expired') || text.includes('"code":190')) {
      throw new BadRequestException({
        message: 'انتهت صلاحية رمز واتساب على السيرفر',
        hint:
          'من Meta Business Manager → System Users أنشئ Permanent Token جديد بصلاحيات whatsapp_business_management و whatsapp_business_messaging، ثم حدّث META_WA_ACCESS_TOKEN على السيرفر. أو استخدم الإدخال اليدوي برمز جديد من WhatsApp → API Setup.',
        detail,
      });
    }
  }

  private async exchangeEmbeddedSignupCode(code: string): Promise<string> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appId || !appSecret) {
      throw new BadRequestException('Meta app credentials are not configured (META_APP_ID / META_APP_SECRET)');
    }

    const webUrl = this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') || 'https://www.chatloora.com';
    const redirectUri = `${webUrl}/whatsapp/embedded-callback`;
    const attempts: Array<Record<string, string>> = [
      // FB.login Embedded Signup codes (no redirect_uri)
      { client_id: appId, client_secret: appSecret, code },
      // LaunchBridge / redirect-based codes
      { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
    ];

    let lastDetail: unknown = null;
    for (const params of attempts) {
      try {
        const { data: short } = await axios.get<{ access_token?: string }>(`${META_GRAPH}/oauth/access_token`, {
          params,
        });
        const shortToken = short.access_token;
        if (!shortToken) continue;

        try {
          const { data: long } = await axios.get<{ access_token?: string }>(`${META_GRAPH}/oauth/access_token`, {
            params: {
              grant_type: 'fb_exchange_token',
              client_id: appId,
              client_secret: appSecret,
              fb_exchange_token: shortToken,
            },
          });
          return long.access_token ?? shortToken;
        } catch {
          return shortToken;
        }
      } catch (error) {
        const ax = error as { response?: { data?: unknown } };
        lastDetail = ax.response?.data ?? String(error);
        this.logger.warn(`[WA embedded signup] token exchange attempt failed: ${JSON.stringify(lastDetail)}`);
      }
    }

    throw new BadRequestException({ message: 'Failed to exchange Embedded Signup code', detail: lastDetail });
  }

  private async fetchPhoneNumberMeta(phoneNumberId: string, accessToken: string) {
    const { data } = await axios.get<{ display_phone_number?: string; verified_name?: string }>(
      `${META_GRAPH}/${phoneNumberId}`,
      { params: { fields: 'display_phone_number,verified_name', access_token: accessToken } },
    );
    return data;
  }

  private async resolveEmbeddedPhoneNumberId(wabaId: string, accessToken: string, hint?: string) {
    if (hint) return hint;
    const { data } = await axios.get<{ data?: Array<{ id?: string }> }>(
      `${META_GRAPH}/${wabaId}/phone_numbers`,
      { params: { access_token: accessToken, fields: 'id,display_phone_number,verified_name' } },
    );
    const first = data.data?.[0];
    if (!first?.id) {
      throw new BadRequestException(
        'No WhatsApp phone number found on this Business account. Complete phone setup in Meta Business Manager, then try again.',
      );
    }
    return first.id;
  }

  private async discoverEmbeddedAssets(accessToken: string): Promise<{ wabaId: string; phoneNumberId: string }> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appId || !appSecret) {
      throw new BadRequestException('Meta app credentials are not configured (META_APP_ID / META_APP_SECRET)');
    }

    const wabaCandidates = new Set<string>();

    try {
      const { data: debug } = await axios.get<{
        data?: { granular_scopes?: Array<{ scope?: string; target_ids?: string[] }> };
      }>(`${META_GRAPH}/debug_token`, {
        params: { input_token: accessToken, access_token: `${appId}|${appSecret}` },
      });
      const scopes = debug.data?.granular_scopes ?? [];
      for (const scope of scopes) {
        if (
          scope.scope === 'whatsapp_business_management' ||
          scope.scope === 'whatsapp_business_messaging'
        ) {
          for (const id of scope.target_ids ?? []) {
            if (id) wabaCandidates.add(id);
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `[WA embedded signup] debug_token discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const { data } = await axios.get<{ data?: Array<{ id?: string }> }>(
        `${META_GRAPH}/me/client_whatsapp_business_accounts`,
        { params: { access_token: accessToken, fields: 'id,name' } },
      );
      for (const row of data.data ?? []) {
        if (row.id) wabaCandidates.add(row.id);
      }
    } catch (error) {
      this.logger.warn(
        `[WA embedded signup] client_whatsapp_business_accounts failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      const { data } = await axios.get<{ data?: Array<{ id?: string }> }>(
        `${META_GRAPH}/me/whatsapp_business_accounts`,
        { params: { access_token: accessToken, fields: 'id,name' } },
      );
      for (const row of data.data ?? []) {
        if (row.id) wabaCandidates.add(row.id);
      }
    } catch (error) {
      this.logger.warn(
        `[WA embedded signup] whatsapp_business_accounts failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      const { data } = await axios.get<{ data?: Array<{ id?: string }> }>(
        `${META_GRAPH}/me/businesses`,
        { params: { access_token: accessToken, fields: 'id,name' } },
      );
      for (const business of data.data ?? []) {
        if (!business.id) continue;
        for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts'] as const) {
          try {
            const listed = await axios.get<{ data?: Array<{ id?: string }> }>(
              `${META_GRAPH}/${business.id}/${edge}`,
              { params: { access_token: accessToken, fields: 'id,name' } },
            );
            for (const row of listed.data.data ?? []) {
              if (row.id) wabaCandidates.add(row.id);
            }
          } catch (error) {
            const ax = error as { response?: { data?: unknown } };
            this.logger.warn(
              `[WA embedded signup] ${edge} failed business=${business.id}: ${JSON.stringify(ax.response?.data ?? (error instanceof Error ? error.message : error))}`,
            );
          }
        }
      }
    } catch (error) {
      const ax = error as { response?: { data?: unknown } };
      this.logger.warn(
        `[WA embedded signup] businesses lookup failed: ${JSON.stringify(ax.response?.data ?? (error instanceof Error ? error.message : error))}`,
      );
    }

    for (const wabaId of wabaCandidates) {
      try {
        const phoneNumberId = await this.resolveEmbeddedPhoneNumberId(wabaId, accessToken);
        return { wabaId, phoneNumberId };
      } catch (error) {
        const ax = error as { response?: { data?: unknown } };
        this.logger.warn(
          `[WA embedded signup] no phone on waba=${wabaId}: ${JSON.stringify(
            ax.response?.data ?? (error instanceof Error ? error.message : error),
          )}`,
        );
      }
    }

    throw new BadRequestException(
      'Could not discover WhatsApp Business account/phone from Meta token. Finish phone setup in Meta Business Manager, then retry or use manual Cloud API credentials.',
    );
  }

  private async subscribeWabaToApp(wabaId: string, accessToken: string) {
    try {
      await axios.post(`${META_GRAPH}/${wabaId}/subscribed_apps`, null, {
        params: { access_token: accessToken },
      });
      this.logger.log(`[WA cloud] subscribed waba=${wabaId}`);
    } catch (error) {
      const ax = error as { response?: { data?: unknown } };
      const detail = ax.response?.data ?? (error instanceof Error ? error.message : String(error));
      this.logger.warn(`[WA cloud] WABA subscribe failed: ${JSON.stringify(detail)}`);
      throw new BadRequestException({
        message:
          'Failed to subscribe WhatsApp Business Account to the app. Check that the access token has whatsapp_business_management permission and the Meta app has WhatsApp product webhooks configured.',
        detail,
      });
    }
  }

  /**
   * Public Meta App Review demo config (cURL shown on /whatsapp-api).
   * Token is never returned in full to the browser.
   */
  getPublicApiSetup() {
    const phoneNumberId = this.config.get<string>('META_WA_PHONE_NUMBER_ID')?.trim() || '';
    const wabaId = this.config.get<string>('META_WA_WABA_ID')?.trim() || '';
    const displayPhone = this.config.get<string>('META_WA_DISPLAY_PHONE')?.trim() || '';
    const tokenConfigured = Boolean(this.config.get<string>('META_WA_ACCESS_TOKEN')?.trim());
    const configured = Boolean(phoneNumberId && tokenConfigured);
    const curl = configured
      ? [
          `curl -i -X POST \\`,
          `  https://graph.facebook.com/v21.0/${phoneNumberId}/messages \\`,
          `  -H 'Authorization: Bearer <ACCESS_TOKEN>' \\`,
          `  -H 'Content-Type: application/json' \\`,
          `  -d '{ "messaging_product": "whatsapp", "to": "<RECIPIENT_WA_ID>", "type": "text", "text": { "body": "Hello from ChatLoora Cloud API" } }'`,
        ].join('\n')
      : null;

    return {
      configured,
      phoneNumberId: phoneNumberId || null,
      wabaId: wabaId || null,
      displayPhone: displayPhone || null,
      graphVersion: 'v21.0',
      endpoint: phoneNumberId ? `${META_GRAPH}/${phoneNumberId}/messages` : null,
      /** Full cURL as required by Meta App Review for whatsapp_business_messaging */
      curl,
      hasAccessToken: tokenConfigured,
      tokenPreview: tokenConfigured ? 'stored' : null,
    };
  }

  async sendPublicTestMessage(to: string, body: string) {
    const phoneNumberId = this.config.get<string>('META_WA_PHONE_NUMBER_ID')?.trim();
    const accessToken = this.config.get<string>('META_WA_ACCESS_TOKEN')?.trim();
    if (!phoneNumberId || !accessToken) {
      throw new BadRequestException('WhatsApp Cloud API demo credentials are not configured on the server');
    }
    return this.sendGraphText(phoneNumberId, accessToken, to, body);
  }

  async sendAccountTestMessage(teamId: string, accountId: string, to: string, body: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: accountId, teamId },
    });
    if (!account) throw new NotFoundException('WhatsApp Cloud account not found');
    if (account.status !== WhatsAppCloudAccountStatus.CONNECTED) {
      throw new BadRequestException('WhatsApp Cloud account is not connected');
    }
    const token = await this.getAccessToken(accountId);
    if (!token) throw new BadRequestException('WhatsApp Cloud access token missing');
    return this.sendGraphText(account.phoneNumberId, token, to, body);
  }

  async testAccountConnection(teamId: string, accountId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: accountId, teamId },
    });
    if (!account) throw new NotFoundException('WhatsApp Cloud account not found');
    const token = await this.getAccessToken(accountId);
    if (!token) throw new BadRequestException('WhatsApp Cloud access token missing');
    await this.validateToken(account.phoneNumberId, token);
    const meta = account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
      ? (account.metadata as Record<string, unknown>)
      : {};
    await this.prisma.whatsAppCloudAccount.update({
      where: { id: accountId },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
        failureReason: null,
        metadata: { ...meta, webhookStatus: 'subscribed' },
      },
    });
    return { ok: true, phoneNumberId: account.phoneNumberId, wabaId: account.wabaId, webhookStatus: 'subscribed' };
  }

  private async sendGraphText(phoneNumberId: string, accessToken: string, toRaw: string, body: string) {
    const to = toRaw.replace(/[^\d]/g, '');
    const text = body.trim();
    if (!to || to.length < 8) throw new BadRequestException('Recipient WhatsApp number is invalid');
    if (!text) throw new BadRequestException('Message body is required');

    try {
      const response = await axios.post(
        `${META_GRAPH}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return {
        ok: true,
        messageId: response.data?.messages?.[0]?.id as string | undefined,
        contacts: response.data?.contacts,
        raw: response.data,
      };
    } catch (error) {
      const ax = error as { response?: { data?: unknown; status?: number } };
      const detail = ax.response?.data ?? String(error);
      throw new BadRequestException({
        message: 'Failed to send WhatsApp Cloud API message',
        detail,
      });
    }
  }

  private async validateToken(phoneNumberId: string, accessToken: string) {
    const pnid = phoneNumberId.trim();
    if (!/^\d{10,20}$/.test(pnid)) {
      throw new BadRequestException(
        'Phone Number ID must be a numeric ID from Meta → WhatsApp → API Setup (not an email or phone number).',
      );
    }
    try {
      await axios.get(`${META_GRAPH}/${pnid}`, {
        params: { fields: 'id,display_phone_number,verified_name', access_token: accessToken },
      });
    } catch (error) {
      const ax = error as { response?: { data?: unknown } };
      this.logger.warn(`[WA cloud] credential validation failed pnid=${pnid}: ${JSON.stringify(ax.response?.data)}`);
      throw this.credentialValidationError(ax.response?.data);
    }
  }
}
