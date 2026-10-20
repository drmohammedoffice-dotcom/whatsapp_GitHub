import { Injectable } from '@nestjs/common';
import { AssistantRealtimeService } from '../../assistant/assistant-realtime.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VoiceAiCallService } from '../../voice-ai/voice-ai-call.service';
import { VoiceAiSettingsService, type VoicePlatformSettings } from '../../voice-ai/voice-ai-settings.service';
import { normalizeE164 } from '../../voice-ai/voice-ai.util';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminVoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: VoiceAiSettingsService,
    private readonly calls: VoiceAiCallService,
    private readonly audit: AdminAuditService,
    private readonly realtime: AssistantRealtimeService,
  ) {}

  getSettings() {
    return this.settings.getPlatform();
  }

  async updateSettings(adminUserId: string, patch: Partial<VoicePlatformSettings>) {
    const next = await this.settings.updatePlatform(patch);
    await this.audit.log({
      adminUserId,
      action: 'voice_ai.settings.update',
      resource: 'voice_ai',
      metadata: { keys: Object.keys(patch) },
    });
    return next;
  }

  async platformAgent() {
    return this.settings.platformAgent();
  }

  async updatePlatformAgent(adminUserId: string, patch: Record<string, unknown>) {
    const agent = await this.settings.platformAgent();
    if (!agent) throw new Error('Platform voice agent missing');
    const next = await this.prisma.voiceAgent.update({
      where: { id: agent.id },
      data: patch as never,
      include: { phoneNumbers: true },
    });
    await this.audit.log({ adminUserId, action: 'voice_ai.agent.update', resource: 'voice_agent', resourceId: agent.id });
    return next;
  }

  async addNumber(adminUserId: string, e164Raw: string, teamId?: string | null) {
    const e164 = normalizeE164(e164Raw);
    const agent = teamId
      ? await this.prisma.voiceAgent.findFirst({ where: { teamId } })
      : await this.settings.platformAgent();
    if (!agent) throw new Error('Voice agent not found');
    const number = await this.prisma.voicePhoneNumber.create({
      data: { e164, agentId: agent.id, teamId: teamId ?? null, provider: 'twilio' },
    });
    await this.audit.log({ adminUserId, action: 'voice_ai.number.create', resource: 'voice_phone', resourceId: number.id });
    return number;
  }

  listNumbers() {
    return this.prisma.voicePhoneNumber.findMany({ orderBy: { createdAt: 'desc' }, include: { agent: { select: { name: true, teamId: true } } } });
  }

  async stats() {
    const [phone, inApp] = await Promise.all([this.calls.stats(), this.realtime.inAppStats()]);
    return {
      ...phone,
      totalCalls: phone.total + inApp.inAppTotal,
      totalMinutes: inApp.inAppMinutes,
      ...inApp,
    };
  }

  listInAppSessions() {
    return this.realtime.listInAppSessions();
  }

  listCalls(take?: number) {
    return this.calls.listCalls({ take: take ?? 80 });
  }

  async getCall(id: string) {
    return this.prisma.voiceCall.findUnique({
      where: { id },
      include: { turns: { orderBy: { createdAt: 'asc' } }, agent: true, phoneNumber: true },
    });
  }
}
