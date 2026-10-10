import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OfficialNotificationType,
  OfficialWhatsAppSenderStatus,
} from '@watsapp/database';
import axios from 'axios';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { META_GRAPH, OFFICIAL_SENDER_ID, normalizeWaDigits } from './official-whatsapp.util';

@Injectable()
export class OfficialWhatsAppSenderService {
  private readonly logger = new Logger(OfficialWhatsAppSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async getOrCreateRow() {
    return this.prisma.officialWhatsAppSender.upsert({
      where: { id: OFFICIAL_SENDER_ID },
      create: { id: OFFICIAL_SENDER_ID },
      update: {},
    });
  }

  /**
   * Public admin view — never includes the access token.
   */
  async getPublicStatus() {
    const row = await this.getOrCreateRow();
    const envToken = this.envToken();
    const hasDbToken = Boolean(row.encryptedAccessToken);
    const tokenSource = hasDbToken ? 'database' : envToken ? 'environment' : 'none';
    return {
      purpose: 'CHATLOORA_OFFICIAL_WHATSAPP_SENDER',
      enabled: row.enabled,
      status: row.status,
      wabaId: row.wabaId || this.config.get<string>('CHATLOORA_WHATSAPP_WABA_ID') || this.config.get<string>('META_WA_WABA_ID') || '',
      phoneNumberId: row.phoneNumberId || this.config.get<string>('CHATLOORA_WHATSAPP_PHONE_NUMBER_ID') || this.config.get<string>('META_WA_PHONE_NUMBER_ID') || '',
      displayPhoneNumber: row.displayPhoneNumber || this.config.get<string>('META_WA_DISPLAY_PHONE') || '',
      displayName: row.displayName,
      webhookStatus: row.webhookStatus,
      lastTestedAt: row.lastTestedAt,
      lastError: row.lastError,
      hasAccessToken: hasDbToken || Boolean(envToken),
      tokenPreview: hasDbToken || envToken ? 'stored' : null,
      tokenSource,
    };
  }

  async save(input: {
    wabaId?: string;
    phoneNumberId?: string;
    displayPhoneNumber?: string;
    displayName?: string;
    accessToken?: string;
    enabled?: boolean;
  }) {
    const row = await this.getOrCreateRow();
    const accessToken = input.accessToken?.trim();
    const data: Record<string, unknown> = {
      wabaId: input.wabaId?.trim() ?? row.wabaId,
      phoneNumberId: input.phoneNumberId?.trim() ?? row.phoneNumberId,
      displayPhoneNumber: input.displayPhoneNumber?.trim() ?? row.displayPhoneNumber,
      displayName: input.displayName?.trim() ?? row.displayName,
      enabled: input.enabled ?? row.enabled,
      lastError: null,
    };
    if (accessToken) {
      data.encryptedAccessToken = this.encryption.encryptJson(accessToken);
    }
    const phoneNumberId = String(data.phoneNumberId ?? '');
    const token = accessToken || (await this.resolveAccessToken());
    if (phoneNumberId && token) {
      await this.validateToken(phoneNumberId, token);
      data.status = OfficialWhatsAppSenderStatus.CONNECTED;
      if (String(data.wabaId ?? '')) {
        await this.subscribeWaba(String(data.wabaId), token);
        data.webhookStatus = 'subscribed';
      }
    } else if (input.enabled === false) {
      data.status = OfficialWhatsAppSenderStatus.DISABLED;
    }

    await this.prisma.officialWhatsAppSender.update({
      where: { id: OFFICIAL_SENDER_ID },
      data,
    });
    this.logger.log('[official-wa] sender configuration saved (token omitted)');
    return this.getPublicStatus();
  }

  async setEnabled(enabled: boolean) {
    await this.prisma.officialWhatsAppSender.update({
      where: { id: OFFICIAL_SENDER_ID },
      data: {
        enabled,
        status: enabled ? OfficialWhatsAppSenderStatus.CONNECTED : OfficialWhatsAppSenderStatus.DISABLED,
      },
    });
    return this.getPublicStatus();
  }

  async disconnect() {
    await this.prisma.officialWhatsAppSender.update({
      where: { id: OFFICIAL_SENDER_ID },
      data: {
        encryptedAccessToken: '',
        enabled: false,
        status: OfficialWhatsAppSenderStatus.DISCONNECTED,
        lastError: null,
      },
    });
    this.logger.log('[official-wa] sender disconnected');
    return this.getPublicStatus();
  }

  async resolveCredentials(): Promise<{ phoneNumberId: string; accessToken: string; wabaId: string; displayPhoneNumber: string }> {
    const row = await this.getOrCreateRow();
    const phoneNumberId =
      row.phoneNumberId ||
      this.config.get<string>('CHATLOORA_WHATSAPP_PHONE_NUMBER_ID')?.trim() ||
      this.config.get<string>('META_WA_PHONE_NUMBER_ID')?.trim() ||
      '';
    const wabaId =
      row.wabaId ||
      this.config.get<string>('CHATLOORA_WHATSAPP_WABA_ID')?.trim() ||
      this.config.get<string>('META_WA_WABA_ID')?.trim() ||
      '';
    const displayPhoneNumber = row.displayPhoneNumber || this.config.get<string>('META_WA_DISPLAY_PHONE')?.trim() || '';
    const accessToken = await this.resolveAccessToken();
    if (!phoneNumberId || !accessToken) {
      throw new BadRequestException('Official Chatloora WhatsApp sender is not configured');
    }
    return { phoneNumberId, accessToken, wabaId, displayPhoneNumber };
  }

  async isOfficialPhoneNumberId(phoneNumberId: string | null | undefined): Promise<boolean> {
    const id = String(phoneNumberId ?? '').trim();
    if (!id) return false;
    const row = await this.getOrCreateRow();
    const envId =
      this.config.get<string>('CHATLOORA_WHATSAPP_PHONE_NUMBER_ID')?.trim() ||
      this.config.get<string>('META_WA_PHONE_NUMBER_ID')?.trim() ||
      '';
    return id === row.phoneNumberId || (Boolean(envId) && id === envId);
  }

  async testConnection(to?: string) {
    const creds = await this.resolveCredentials();
    await this.validateToken(creds.phoneNumberId, creds.accessToken);
    if (to) {
      const result = await this.sendText(to, 'Chatloora official WhatsApp test message');
      await this.prisma.officialWhatsAppSender.update({
        where: { id: OFFICIAL_SENDER_ID },
        data: { lastTestedAt: new Date(), lastError: null, status: OfficialWhatsAppSenderStatus.CONNECTED },
      });
      return { ok: true, messageId: result.messageId };
    }
    await this.prisma.officialWhatsAppSender.update({
      where: { id: OFFICIAL_SENDER_ID },
      data: { lastTestedAt: new Date(), lastError: null, status: OfficialWhatsAppSenderStatus.CONNECTED },
    });
    return { ok: true, validated: true };
  }

  async sendText(toRaw: string, body: string) {
    const creds = await this.assertEnabled();
    const to = normalizeWaDigits(toRaw);
    if (to.length < 8) throw new BadRequestException('Recipient phone is invalid');
    try {
      const response = await axios.post(
        `${META_GRAPH}/${creds.phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { messageId: response.data?.messages?.[0]?.id as string | undefined };
    } catch (error) {
      throw this.graphError(error, 'Failed to send official WhatsApp text');
    }
  }

  async sendAuthenticationTemplate(input: {
    to: string;
    templateName: string;
    language: string;
    code: string;
  }) {
    const creds = await this.assertEnabled();
    const to = normalizeWaDigits(input.to);
    if (to.length < 8) throw new BadRequestException('Recipient phone is invalid');
    const templateName = input.templateName.trim();
    if (!templateName) throw new BadRequestException('WhatsApp OTP template name is not configured');

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: input.language || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: input.code }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: input.code }],
          },
        ],
      },
    };

    try {
      const response = await axios.post(`${META_GRAPH}/${creds.phoneNumberId}/messages`, payload, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      return { messageId: response.data?.messages?.[0]?.id as string | undefined };
    } catch (error) {
      const ax = error as { response?: { data?: { error?: { code?: number; error_data?: { details?: string } } } } };
      const details = String(ax.response?.data?.error?.error_data?.details ?? '');
      if (/button/i.test(details)) {
        try {
          const retry = await axios.post(
            `${META_GRAPH}/${creds.phoneNumberId}/messages`,
            {
              ...payload,
              template: {
                ...payload.template,
                components: [{ type: 'body', parameters: [{ type: 'text', text: input.code }] }],
              },
            },
            { headers: { Authorization: `Bearer ${creds.accessToken}` } },
          );
          return { messageId: retry.data?.messages?.[0]?.id as string | undefined };
        } catch (retryError) {
          throw this.graphError(retryError, 'Official WhatsApp OTP template send failed');
        }
      }
      throw this.graphError(error, 'Official WhatsApp OTP template send failed');
    }
  }

  async sendNamedTemplate(input: {
    to: string;
    type: OfficialNotificationType;
    parameters?: string[];
  }) {
    const creds = await this.assertEnabled();
    const to = normalizeWaDigits(input.to);
    const tpl = await this.prisma.officialWhatsAppTemplate.findUnique({ where: { type: input.type } });
    if (!tpl?.enabled || !tpl.name.trim()) {
      throw new BadRequestException(`Official WhatsApp template ${input.type} is not enabled`);
    }
    const components =
      input.parameters && input.parameters.length
        ? [{ type: 'body', parameters: input.parameters.map((text) => ({ type: 'text', text })) }]
        : [];
    try {
      const response = await axios.post(
        `${META_GRAPH}/${creds.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: tpl.name.trim(),
            language: { code: tpl.language || 'en' },
            ...(components.length ? { components } : {}),
          },
        },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { messageId: response.data?.messages?.[0]?.id as string | undefined, templateName: tpl.name };
    } catch (error) {
      throw this.graphError(error, `Official WhatsApp template ${input.type} failed`);
    }
  }

  private async assertEnabled() {
    const row = await this.getOrCreateRow();
    if (!row.enabled && !this.envToken()) {
      throw new BadRequestException('Official Chatloora WhatsApp sender is disabled');
    }
    if (!row.enabled) {
      throw new BadRequestException('Official Chatloora WhatsApp sender is disabled');
    }
    return this.resolveCredentials();
  }

  private async resolveAccessToken(): Promise<string> {
    const row = await this.getOrCreateRow();
    if (row.encryptedAccessToken) {
      try {
        return this.encryption.decryptJson<string>(row.encryptedAccessToken);
      } catch {
        this.logger.warn('[official-wa] stored token could not be decrypted');
      }
    }
    return this.envToken();
  }

  private envToken() {
    return (
      this.config.get<string>('CHATLOORA_WHATSAPP_ACCESS_TOKEN')?.trim() ||
      this.config.get<string>('META_WA_ACCESS_TOKEN')?.trim() ||
      ''
    );
  }

  private async validateToken(phoneNumberId: string, accessToken: string) {
    if (!/^\d{10,20}$/.test(phoneNumberId)) {
      throw new BadRequestException('Official Phone Number ID must be numeric');
    }
    try {
      await axios.get(`${META_GRAPH}/${phoneNumberId}`, {
        params: { fields: 'id,display_phone_number,verified_name', access_token: accessToken },
      });
    } catch (error) {
      throw this.graphError(error, 'Official WhatsApp token validation failed');
    }
  }

  private async subscribeWaba(wabaId: string, accessToken: string) {
    try {
      await axios.post(`${META_GRAPH}/${wabaId}/subscribed_apps`, null, {
        params: { access_token: accessToken },
      });
    } catch (error) {
      const ax = error as { response?: { data?: unknown } };
      this.logger.warn(`[official-wa] WABA subscribe failed: ${JSON.stringify(ax.response?.data ?? {})}`);
    }
  }

  private graphError(error: unknown, message: string) {
    const ax = error as { response?: { data?: unknown } };
    const detail = ax.response?.data ?? (error instanceof Error ? error.message : 'unknown');
    this.logger.warn(`[official-wa] ${message}`);
    return new BadRequestException({ message, detail });
  }
}
