import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { ChannelMetadataWithPurpose } from '../channels/channel-purpose';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { isLikelyPhoneNumber, resolveStoredPhone } from '../modules/whatsapp/utils/disconnect.util';
import { WhatsAppService } from '../modules/whatsapp/whatsapp.service';

@Injectable()
export class TikTokTrackingPhonesService {
  constructor(
    private readonly channels: ChannelsService,
    private readonly whatsapp: WhatsAppService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  private resolvePhoneNumber(row: {
    id: string;
    externalId: string | null;
    metadata: unknown;
    whatsAppSession?: { phoneNumber?: string | null; jid?: string | null; displayName?: string | null } | null;
  }) {
    const metadata = row.metadata as ChannelMetadataWithPurpose | null;
    return resolveStoredPhone({
      phoneNumber: row.whatsAppSession?.phoneNumber ?? metadata?.phoneNumber,
      jid: row.whatsAppSession?.jid,
      externalId: row.externalId,
    });
  }

  async list(teamId: string) {
    const rows = await this.channels.listTrackingChannels(teamId);
    return Promise.all(
      rows.map(async (row) => {
        let phoneNumber = this.resolvePhoneNumber(row);

        if (!phoneNumber && row.whatsAppSessionId) {
          phoneNumber = await this.whatsapp.resolveSessionPhoneNumber(teamId, row.whatsAppSessionId);
        }

        const sessionStatus = row.whatsAppSession?.status ?? 'DISCONNECTED';
        const status =
          row.status === 'CONNECTED' || sessionStatus === 'CONNECTED'
            ? 'CONNECTED'
            : sessionStatus === 'PENDING_QR' || sessionStatus === 'CONNECTING'
              ? 'CONNECTING'
              : row.status;

        return {
          channelId: row.id,
          sessionId: row.whatsAppSessionId,
          phoneNumber,
          displayName: phoneNumber,
          status,
          connectedAt: row.whatsAppSession?.connectedAt?.toISOString() ?? null,
          integrationId: (row.metadata as ChannelMetadataWithPurpose | null)?.integrationId ?? null,
        };
      }),
    );
  }

  async isPixelPhoneConnected(teamId: string, whatsappNumber: string | null | undefined): Promise<boolean> {
    const configured = whatsappNumber?.replace(/\D/g, '') ?? '';
    if (configured.length < 10) return false;
    const phones = await this.list(teamId);
    return phones.some((row) => {
      if (!row.phoneNumber) return false;
      const phone = row.phoneNumber.replace(/\D/g, '');
      const live =
        row.status === 'CONNECTED' ||
        row.status === 'CONNECTING';
      if (!live) return false;
      return phone === configured || phone.slice(-10) === configured.slice(-10);
    });
  }

  async connect(teamId: string, userId: string, input?: { displayName?: string; integrationId?: string }) {
    await this.entitlements.assertTrackingPhoneConnect(teamId);
    return this.whatsapp.connect(teamId, userId, input?.displayName, undefined, {
      purpose: 'tracking',
      integrationId: input?.integrationId,
    });
  }

  getQr(teamId: string, sessionId: string) {
    return this.whatsapp.getQr(teamId, sessionId);
  }

  getStatus(teamId: string, sessionId: string) {
    return this.whatsapp.getStatus(teamId, sessionId);
  }

  disconnect(teamId: string, sessionId: string, userId: string) {
    return this.whatsapp.disconnect(teamId, sessionId, userId);
  }

  deleteSession(teamId: string, sessionId: string, userId: string) {
    return this.whatsapp.deleteSession(teamId, sessionId, userId);
  }
}
