import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelPurpose } from '@watsapp/database';
import { ChannelsService } from '../channels/channels.service';
import { ChannelMetadataWithPurpose } from '../channels/channel-purpose';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { isLikelyPhoneNumber, resolveStoredPhone } from '../modules/whatsapp/utils/disconnect.util';
import { WhatsAppService } from '../modules/whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokIntegrationTrackingService } from './tiktok-integration-tracking.service';

/**
 * TikTok Pixel → WhatsApp Business (System B).
 * Completely isolated from Integrations → WhatsApp / Inbox (System A).
 */
@Injectable()
export class TikTokTrackingPhonesService {
  constructor(
    private readonly channels: ChannelsService,
    private readonly whatsapp: WhatsAppService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly prisma: PrismaService,
    private readonly tracking: TikTokIntegrationTrackingService,
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
      externalId: row.externalId?.startsWith('tracking:') ? row.externalId.slice('tracking:'.length) : row.externalId,
    });
  }

  async list(teamId: string) {
    const rows = await this.channels.listTrackingChannels(teamId);
    const integrationIds = [
      ...new Set(
        rows
          .map((row) => (row.metadata as ChannelMetadataWithPurpose | null)?.integrationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const integrations = integrationIds.length
      ? await this.prisma.tikTokIntegration.findMany({
          where: { teamId, id: { in: integrationIds } },
          select: { id: true, name: true, pixelName: true, pixelCode: true, whatsappNumber: true },
        })
      : [];
    const byId = new Map(integrations.map((row) => [row.id, row]));

    return Promise.all(
      rows.map(async (row) => {
        let phoneNumber = this.resolvePhoneNumber(row);

        if (!phoneNumber && row.whatsAppSessionId) {
          phoneNumber = await this.whatsapp.resolveSessionPhoneNumber(teamId, row.whatsAppSessionId);
        }

        const sessionStatus = row.whatsAppSession?.status ?? 'DISCONNECTED';
        // Session status is authoritative — channel row can stay stale as CONNECTED after logout.
        const status =
          sessionStatus === 'CONNECTED'
            ? 'CONNECTED'
            : sessionStatus === 'PENDING_QR' || sessionStatus === 'CONNECTING'
              ? 'CONNECTING'
              : sessionStatus === 'FAILED'
                ? 'FAILED'
                : row.status === 'CONNECTED' && sessionStatus === 'DISCONNECTED'
                  ? 'DISCONNECTED'
                  : row.status;

        const integrationId = (row.metadata as ChannelMetadataWithPurpose | null)?.integrationId ?? null;
        const integration = integrationId ? byId.get(integrationId) : null;

        return {
          channelId: row.id,
          sessionId: row.whatsAppSessionId,
          phoneNumber,
          displayName: phoneNumber,
          status,
          connectedAt: row.whatsAppSession?.connectedAt?.toISOString() ?? null,
          integrationId,
          pixelName: integration?.pixelName ?? integration?.name ?? null,
          pixelCode: integration?.pixelCode ?? null,
          system: 'tiktok_tracking' as const,
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
      const live = row.status === 'CONNECTED' || row.status === 'CONNECTING';
      if (!live) return false;
      return phone === configured || phone.slice(-10) === configured.slice(-10);
    });
  }

  async connect(teamId: string, userId: string, input?: { displayName?: string; integrationId?: string }) {
    await this.entitlements.assertTrackingPhoneConnect(teamId);
    if (input?.integrationId) {
      const integration = await this.prisma.tikTokIntegration.findFirst({
        where: { id: input.integrationId, teamId },
        select: { id: true },
      });
      if (!integration) throw new NotFoundException('Pixel integration not found');
    }
    return this.whatsapp.connect(teamId, userId, input?.displayName, undefined, {
      purpose: 'tracking',
      integrationId: input?.integrationId,
    });
  }

  /**
   * Link an already-connected tracking WhatsApp to a specific pixel so Contact+Lead
   * attribute to that pixel when messages arrive on this number.
   */
  async linkToIntegration(teamId: string, channelId: string, integrationId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, teamId, purpose: ChannelPurpose.TRACKING },
      include: { whatsAppSession: true },
    });
    if (!channel) throw new NotFoundException('Tracking WhatsApp not found');

    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { id: integrationId, teamId },
      select: { id: true },
    });
    if (!integration) throw new NotFoundException('Pixel integration not found');

    const phoneNumber = this.resolvePhoneNumber(channel);
    if (phoneNumber && !isLikelyPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Tracking WhatsApp has no valid phone number yet — wait until connected');
    }

    await this.tracking.bindChannelToIntegration(channelId, integrationId, phoneNumber);
    if (channel.whatsAppSessionId && phoneNumber) {
      await this.tracking.syncTrackingPhoneOnConnect(teamId, channel.whatsAppSessionId, phoneNumber);
    }

    const phones = await this.list(teamId);
    return phones.find((row) => row.channelId === channelId) ?? null;
  }

  getQr(teamId: string, sessionId: string) {
    return this.whatsapp.getQr(teamId, sessionId, ChannelPurpose.TRACKING);
  }

  getStatus(teamId: string, sessionId: string) {
    return this.whatsapp.getStatus(teamId, sessionId, ChannelPurpose.TRACKING);
  }

  disconnect(teamId: string, sessionId: string, userId: string) {
    return this.whatsapp.disconnect(teamId, sessionId, userId, ChannelPurpose.TRACKING);
  }

  deleteSession(teamId: string, sessionId: string, userId: string) {
    return this.whatsapp.deleteSession(teamId, sessionId, userId, ChannelPurpose.TRACKING);
  }
}
