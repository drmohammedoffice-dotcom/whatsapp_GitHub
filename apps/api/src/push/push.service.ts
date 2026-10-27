import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TeamRole } from '@watsapp/database';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;
/** At most one "new message" push per conversation in this window. */
const CONVERSATION_COOLDOWN_MS = 60_000;

export type PushMessage = {
  title: string;
  body: string;
  /** Relative web path the app opens when the notification is tapped. */
  url?: string;
  channelId?: 'messages' | 'default';
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly recentConversations = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isValidToken(token: string) {
    return EXPO_TOKEN.test(token);
  }

  async register(userId: string, teamId: string | undefined, token: string, platform: string, appVersion?: string) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, teamId: teamId ?? null, token, platform, appVersion: appVersion ?? null },
      update: { userId, teamId: teamId ?? null, platform, appVersion: appVersion ?? null, lastSeenAt: new Date() },
    });
  }

  async unregister(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
  }

  /** Notifies every member of the team that has the app installed. Never throws. */
  async notifyTeam(teamId: string, message: PushMessage) {
    try {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId, role: { in: [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER] } },
        select: { userId: true },
      });
      if (!members.length) return;
      const devices = await this.prisma.deviceToken.findMany({
        where: { userId: { in: members.map((m) => m.userId) } },
        select: { token: true },
      });
      await this.send(devices.map((d) => d.token), message);
    } catch (error) {
      this.logger.warn(`Push to team ${teamId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** New inbound WhatsApp message in the inbox (throttled per conversation). */
  async notifyInboxMessage(input: { teamId: string; conversationId: string; senderName?: string | null; preview?: string | null }) {
    const now = Date.now();
    const last = this.recentConversations.get(input.conversationId) ?? 0;
    if (now - last < CONVERSATION_COOLDOWN_MS) return;
    this.recentConversations.set(input.conversationId, now);
    if (this.recentConversations.size > 5000) {
      for (const [id, at] of this.recentConversations) if (now - at > CONVERSATION_COOLDOWN_MS) this.recentConversations.delete(id);
    }
    const includePreview = this.config.get<string>('PUSH_INCLUDE_MESSAGE_PREVIEW') !== 'false';
    const preview = (input.preview ?? '').replace(/\s+/g, ' ').trim();
    await this.notifyTeam(input.teamId, {
      title: input.senderName?.trim() || 'رسالة واتساب جديدة',
      body: includePreview && preview ? preview.slice(0, 120) : 'لديك رسالة جديدة في صندوق واتساب',
      url: `/inbox/whatsapp?c=${encodeURIComponent(input.conversationId)}`,
      channelId: 'messages',
    });
  }

  private async send(tokens: string[], message: PushMessage) {
    const valid = [...new Set(tokens)].filter((t) => this.isValidToken(t));
    if (!valid.length) return;
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    for (let i = 0; i < valid.length; i += EXPO_BATCH) {
      const batch = valid.slice(i, i + EXPO_BATCH);
      const payload = batch.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        sound: 'default',
        priority: 'high',
        channelId: message.channelId ?? 'default',
        data: message.url ? { url: message.url } : {},
      }));
      const { data } = await axios.post(EXPO_PUSH_URL, payload, {
        timeout: 10_000,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const tickets = (data?.data ?? []) as Array<{ status?: string; details?: { error?: string } }>;
      const dead = batch.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered');
      if (dead.length) await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    }
  }
}
