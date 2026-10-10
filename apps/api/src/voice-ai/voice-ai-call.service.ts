import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceAiCoreService } from './voice-ai-core.service';
import { VoiceAiSettingsService } from './voice-ai-settings.service';
import { escapeXml, spokenReply, twimlDocument } from './voice-ai.util';

@Injectable()
export class VoiceAiCallService {
  private readonly logger = new Logger(VoiceAiCallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: VoiceAiSettingsService,
    private readonly core: VoiceAiCoreService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly config: ConfigService,
  ) {}

  webhookBase() {
    const publicUrl = (this.config.get<string>('API_PUBLIC_URL') || '').replace(/\/$/, '');
    return `${publicUrl}/api/webhooks/twilio`;
  }

  async startIncoming(params: { callSid: string; from: string; to: string }) {
    this.logger.warn(JSON.stringify({ event: 'CALL_DISABLED', callSid: params.callSid, from: params.from, to: params.to }));
    return this.sayAndHangup('خدمة الاتصال الصوتي متوقفة حالياً. تقدر تتواصل عبر محادثة المنصة.');
  }

  async handleGather(params: { callSid: string; speech: string }) {
    this.logger.warn(JSON.stringify({ event: 'CALL_DISABLED', callSid: params.callSid, speech: params.speech ? 1 : 0 }));
    return this.sayAndHangup('خدمة الاتصال الصوتي متوقفة حالياً. تقدر تتواصل عبر محادثة المنصة.');
  }

  async handleStatus(params: {
    callSid: string;
    status: string;
    duration?: string;
    recordingUrl?: string;
    cost?: string;
  }) {
    const call = await this.prisma.voiceCall.findUnique({
      where: { providerCallSid: params.callSid },
      include: { turns: { orderBy: { createdAt: 'asc' } }, agent: true },
    });
    if (!call) return { ok: true };

    const mapped = this.mapStatus(params.status);
    const durationSec = params.duration ? Number(params.duration) : call.durationSec;
    const costCents = params.cost ? Math.round(Number(params.cost) * 100) : call.costCents;

    const alreadyEnded = call.status === 'completed' || call.status === 'failed';
    await this.prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        status: mapped,
        endedAt: mapped === 'completed' || mapped === 'failed' ? new Date() : call.endedAt,
        durationSec: Number.isFinite(durationSec) ? durationSec : call.durationSec,
        recordingUrl: params.recordingUrl || call.recordingUrl,
        costCents: Number.isFinite(costCents as number) ? costCents : call.costCents,
        summary: call.summary,
        outcome: call.outcome ?? (mapped === 'completed' ? 'completed' : mapped),
      },
    });

    if (!alreadyEnded && (mapped === 'completed' || mapped === 'failed') && durationSec && durationSec > 0) {
      const minutes = Math.max(1, Math.ceil(durationSec / 60));
      await this.prisma.voiceAgent.update({
        where: { id: call.agentId },
        data: { minutesUsed: { increment: minutes } },
      });
      this.logger.log(JSON.stringify({ event: mapped === 'failed' ? 'CALL_FAILED' : 'CALL_ENDED', callId: call.id, durationSec }));
    }

    return { ok: true };
  }

  async getCallForTeam(teamId: string, id: string) {
    const call = await this.prisma.voiceCall.findFirst({
      where: { id, teamId },
      include: { turns: { orderBy: { createdAt: 'asc' } } },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async listCalls(filter: { teamId?: string | null; take?: number }) {
    return this.prisma.voiceCall.findMany({
      where: filter.teamId === undefined ? undefined : { teamId: filter.teamId },
      orderBy: { startedAt: 'desc' },
      take: filter.take ?? 50,
      include: { agent: { select: { name: true } }, phoneNumber: { select: { e164: true } } },
    });
  }

  async stats(teamId?: string | null) {
    const where = teamId === undefined ? {} : { teamId };
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const [total, today, month, completed, failed, handoff, avg] = await Promise.all([
      this.prisma.voiceCall.count({ where }),
      this.prisma.voiceCall.count({ where: { ...where, startedAt: { gte: startOfDay } } }),
      this.prisma.voiceCall.count({ where: { ...where, startedAt: { gte: startOfMonth } } }),
      this.prisma.voiceCall.count({ where: { ...where, status: 'completed' } }),
      this.prisma.voiceCall.count({ where: { ...where, status: 'failed' } }),
      this.prisma.voiceCall.count({ where: { ...where, handledBy: 'HUMAN' } }),
      this.prisma.voiceCall.aggregate({ where: { ...where, durationSec: { not: null } }, _avg: { durationSec: true }, _sum: { costCents: true } }),
    ]);
    return {
      total,
      today,
      month,
      completed,
      failed,
      aiHandled: Math.max(0, total - handoff),
      handedOff: handoff,
      averageDurationSec: Math.round(avg._avg.durationSec ?? 0),
      costCents: avg._sum.costCents ?? 0,
    };
  }

  private sayAndHangup(message: string) {
    return twimlDocument(
      `<Say language="ar-AE" voice="Polly.Zeina">${escapeXml(spokenReply(message))}</Say><Hangup/>`,
    );
  }

  private mapStatus(status: string) {
    const value = (status || '').toLowerCase();
    if (value === 'completed') return 'completed';
    if (value === 'failed' || value === 'busy' || value === 'no-answer' || value === 'canceled') return 'failed';
    if (value === 'in-progress' || value === 'answered') return 'in_progress';
    return value || 'in_progress';
  }
}
