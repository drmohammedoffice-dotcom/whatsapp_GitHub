import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantKnowledgeService } from './assistant-knowledge.service';
import { navigationCatalogForPrompt, routeByPath } from './assistant-nav';
import { AssistantSettingsService } from './assistant-settings.service';
import { supportWhatsAppUrl } from './assistant.util';
import {
  ALLOWED_REALTIME_TOOLS,
  DEFAULT_REALTIME_MODEL,
  REALTIME_MODEL_FALLBACKS,
  REALTIME_TOOLS,
  appendTranscriptTurn,
  buildRealtimeVoicePrompt,
  estimateCostMillis,
  extractClientSecret,
  extractFunctionCall,
  minutesFromSeconds,
  monthWindow,
  openaiErrorSnippet,
  parseRealtimeUsage,
  quotaMessages,
  resolveRealtimeVoice,
  type RealtimeVoiceId,
} from './assistant-realtime.util';

const MINUTES_EXHAUSTED = 'VOICE_MINUTES_EXHAUSTED';

@Injectable()
export class AssistantRealtimeService {
  private readonly logger = new Logger(AssistantRealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AssistantSettingsService,
    private readonly knowledge: AssistantKnowledgeService,
    private readonly context: AssistantContextService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly config: ConfigService,
  ) {}

  openaiKey() {
    return (this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY || '').trim();
  }

  openaiBase() {
    return (this.config.get<string>('OPENAI_API_BASE_URL') || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(
      /\/$/,
      '',
    );
  }

  realtimeModel() {
    return this.config.get<string>('VOICE_AI_MODEL')?.trim() || DEFAULT_REALTIME_MODEL;
  }

  realtimeEnabledByEnv() {
    return false;
  }

  async publicVoiceConfig() {
    const platform = await this.inAppSettings();
    return {
      realtimeEnabled: this.realtimeEnabledByEnv() && platform.inAppRealtimeEnabled !== false,
      model: this.realtimeModel(),
      voices: [
        { id: 'cedar', gender: 'male', labelAr: 'Cedar — صوت رجالي', labelEn: 'Cedar — masculine voice' },
        { id: 'marin', gender: 'female', labelAr: 'Marin — صوت نسائي', labelEn: 'Marin — feminine voice' },
      ],
      defaultVoice: resolveRealtimeVoice(platform.femaleVoice || platform.defaultInAppVoice || 'marin'),
      maxCallDurationSec: platform.maxInAppCallSec || 600,
      transcriptEnabled: platform.inAppTranscriptEnabled !== false,
    };
  }

  async createSession(teamId: string, userId: string, input: { voice?: string; conversationId?: string; language?: string }) {
    const cfg = await this.settings.get();
    if (!cfg.enabled) throw new ForbiddenException('Assistant is disabled');
    const platform = await this.inAppSettings();
    if (!this.realtimeEnabledByEnv() || platform.inAppRealtimeEnabled === false) {
      throw new ServiceUnavailableException('الاتصال الصوتي متوقف. استخدم محادثة المساعد النصية.');
    }
    await this.assertQuota(teamId);

    const voice = resolveRealtimeVoice(input.voice || platform.defaultInAppVoice);
    let conversation = input.conversationId
      ? await this.prisma.platformAssistantConversation.findFirst({ where: { id: input.conversationId, teamId, userId } })
      : null;
    if (input.conversationId && !conversation) throw new NotFoundException('Conversation not found');
    if (!conversation) {
      conversation = await this.prisma.platformAssistantConversation.create({
        data: { teamId, userId, title: 'مكالمة صوتية' },
      });
    }

    const session = await this.prisma.assistantVoiceSession.create({
      data: {
        teamId,
        userId,
        conversationId: conversation.id,
        status: 'created',
        provider: 'openai',
        model: platform.realtimeModel.trim() || this.realtimeModel(),
        voice,
        language: (input.language || 'ar').slice(0, 8),
      },
    });

    const instructions = await this.buildInstructions(teamId, conversation.id, voice);
    const minted = await this.mintClientSecret(session.model, voice, instructions, userId);
    if (minted.model !== session.model) {
      await this.prisma.assistantVoiceSession.update({ where: { id: session.id }, data: { model: minted.model } });
    }

    return {
      sessionId: session.id,
      conversationId: conversation.id,
      voice,
      model: minted.model,
      clientSecret: minted.secret,
      callsUrl: `${this.openaiBase()}/realtime/calls`,
      maxCallDurationSec: platform.maxInAppCallSec || 600,
      transcriptEnabled: platform.inAppTranscriptEnabled !== false,
      supportUrl: supportWhatsAppUrl(cfg.supportWhatsApp || cfg.supportPhone),
    };
  }

  async connectSdp(teamId: string, userId: string, sessionId: string, offerSdp: string) {
    if (!offerSdp?.includes('v=0')) throw new BadRequestException('Invalid SDP offer');
    const session = await this.loadOwned(teamId, userId, sessionId);
    if (session.status === 'ended' || session.status === 'failed') {
      throw new BadRequestException('Voice session already closed');
    }

    const instructions = await this.buildInstructions(teamId, session.conversationId, session.voice as RealtimeVoiceId);
    const model = session.model || this.realtimeModel();
    const payload = this.sessionPayload(model, session.voice, instructions);
    const answer = await this.exchangeSdp(offerSdp, payload, userId);
    await this.prisma.assistantVoiceSession.update({
      where: { id: session.id },
      data: { status: 'live' },
    });
    return { sdp: answer };
  }

  async runTool(teamId: string, userId: string, sessionId: string, input: { name: string; arguments?: string; callId?: string }) {
    const session = await this.loadOwned(teamId, userId, sessionId);
    if (!ALLOWED_REALTIME_TOOLS.has(input.name)) {
      throw new ForbiddenException('Tool is not allowed');
    }
    const args = this.parseArgs(input.arguments);
    if (input.name === 'get_workspace_status') {
      const snapshot = await this.context.snapshot(teamId);
      return { callId: input.callId, output: snapshot };
    }
    if (input.name === 'search_knowledge') {
      const query = String(args.query ?? '');
      const articles = await this.knowledge.retrieve(query);
      return {
        callId: input.callId,
        output: articles.map((a) => ({ titleAr: a.titleAr, titleEn: a.titleEn, bodyAr: a.bodyAr.slice(0, 1200) })),
      };
    }
    if (input.name === 'request_human_support') {
      const cfg = await this.settings.get();
      await this.prisma.assistantVoiceSession.update({
        where: { id: session.id },
        data: { handoffRequested: true },
      });
      return {
        callId: input.callId,
        output: {
          handoff: true,
          speak: 'أكيد، أگدر أوصلك بفريق الدعم. اضغط زر واتساب الظاهر الآن.',
          supportUrl: supportWhatsAppUrl(cfg.supportWhatsApp || cfg.supportPhone),
        },
        clientEvent: { type: 'handoff', supportUrl: supportWhatsAppUrl(cfg.supportWhatsApp || cfg.supportPhone) },
      };
    }
    if (input.name === 'navigate_in_app') {
      const action = routeByPath(String(args.path ?? ''));
      if (!action) return { callId: input.callId, output: { ok: false, error: 'path_not_allowed' } };
      return {
        callId: input.callId,
        output: {
          ok: true,
          path: action.path,
          labelAr: action.labelAr,
          labelEn: action.labelEn,
          stayOnCall: true,
          speak: `فتحت صفحة ${action.labelAr}. المكالمة مستمرة، أكمل الشرح صوتياً ولا تودّع.`,
        },
        clientEvent: { type: 'navigate', path: action.path, labelAr: action.labelAr, labelEn: action.labelEn },
      };
    }
    throw new BadRequestException('Unknown tool');
  }

  async ingest(teamId: string, userId: string, sessionId: string, body: { event?: Record<string, unknown>; usage?: unknown }) {
    const session = await this.loadOwned(teamId, userId, sessionId);
    const event = body.event ?? {};
    const patch: Prisma.AssistantVoiceSessionUpdateInput = {};
    const role =
      event.type === 'conversation.item.input_audio_transcription.completed' ||
      event.type === 'conversation.item.input_audio_transcription.delta'
        ? 'user'
        : event.type === 'response.output_audio_transcript.done' ||
            event.type === 'response.audio_transcript.done'
          ? 'assistant'
          : null;
    const text =
      typeof event.transcript === 'string'
        ? event.transcript
        : typeof (event.item as { transcript?: string } | undefined)?.transcript === 'string'
          ? (event.item as { transcript: string }).transcript
          : '';
    if (role && text.trim()) {
      patch.transcript = appendTranscriptTurn(session.transcript, {
        role,
        content: text.trim(),
        at: new Date().toISOString(),
      }) as unknown as Prisma.InputJsonValue;
      if (session.conversationId && text.trim().length > 1) {
        await this.prisma.platformAssistantMessage.create({
          data: {
            conversationId: session.conversationId,
            role: role === 'user' ? 'USER' : 'ASSISTANT',
            content: role === 'user' ? `🎤 ${text.trim()}` : text.trim(),
          },
        });
      }
    }
    const usage = parseRealtimeUsage(body.usage ?? event);
    if (usage.audioInputMs || usage.audioOutputMs || usage.textTokens) {
      patch.usage = usage as unknown as Prisma.InputJsonValue;
      patch.costMillis = estimateCostMillis(usage);
    }
    if (extractFunctionCall(event)?.name === 'request_human_support') {
      patch.handoffRequested = true;
    }
    if (Object.keys(patch).length) {
      await this.prisma.assistantVoiceSession.update({ where: { id: session.id }, data: patch });
    }
    return { ok: true };
  }

  async endSession(teamId: string, userId: string, sessionId: string, input?: { reason?: string; summary?: string }) {
    const session = await this.loadOwned(teamId, userId, sessionId);
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000));
    const failed = input?.reason && input.reason !== 'hangup';
    await this.prisma.assistantVoiceSession.update({
      where: { id: session.id },
      data: {
        status: failed ? 'failed' : 'ended',
        endedAt,
        durationSec,
        summary: input?.summary?.slice(0, 2000),
        failureReason: failed ? input?.reason?.slice(0, 200) : null,
      },
    });
    return { ok: true, durationSec };
  }

  async inAppStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const [total, today, month, failed, handoff, avg] = await Promise.all([
      this.prisma.assistantVoiceSession.count(),
      this.prisma.assistantVoiceSession.count({ where: { startedAt: { gte: startOfDay } } }),
      this.prisma.assistantVoiceSession.count({ where: { startedAt: { gte: startOfMonth } } }),
      this.prisma.assistantVoiceSession.count({ where: { status: 'failed' } }),
      this.prisma.assistantVoiceSession.count({ where: { handoffRequested: true } }),
      this.prisma.assistantVoiceSession.aggregate({
        where: { durationSec: { not: null } },
        _avg: { durationSec: true },
        _sum: { durationSec: true, costMillis: true },
      }),
    ]);
    return {
      inAppTotal: total,
      inAppToday: today,
      inAppMonth: month,
      inAppFailed: failed,
      inAppHandoff: handoff,
      inAppAverageDurationSec: Math.round(avg._avg.durationSec ?? 0),
      inAppMinutes: minutesFromSeconds(avg._sum.durationSec ?? 0),
      inAppCostMillis: avg._sum.costMillis ?? 0,
    };
  }

  async listInAppSessions(take = 40) {
    return this.prisma.assistantVoiceSession.findMany({
      orderBy: { startedAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        voice: true,
        language: true,
        durationSec: true,
        handoffRequested: true,
        summary: true,
        startedAt: true,
        costMillis: true,
      },
    });
  }

  private async assertQuota(teamId: string) {
    const entitlements = await this.entitlements.assertVoiceAiEnabled(teamId);
    const { start } = monthWindow();
    const [sum, calls] = await Promise.all([
      this.prisma.assistantVoiceSession.aggregate({
        where: { teamId, startedAt: { gte: start }, status: { not: 'failed' } },
        _sum: { durationSec: true },
      }),
      this.prisma.assistantVoiceSession.count({ where: { teamId, startedAt: { gte: start } } }),
    ]);
    const usedMinutes = minutesFromSeconds(sum._sum.durationSec ?? 0);
    if (entitlements.limits.voiceMinutesLimit >= 0 && usedMinutes >= entitlements.limits.voiceMinutesLimit) {
      throw new ForbiddenException({ message: quotaMessages('minutes'), code: MINUTES_EXHAUSTED });
    }
    if (entitlements.limits.voiceCallsLimit >= 0 && calls >= entitlements.limits.voiceCallsLimit) {
      throw new ForbiddenException({ message: quotaMessages('calls'), code: 'VOICE_CALLS_EXHAUSTED' });
    }
  }

  private async loadOwned(teamId: string, userId: string, sessionId: string) {
    const session = await this.prisma.assistantVoiceSession.findFirst({ where: { id: sessionId, teamId, userId } });
    if (!session) throw new NotFoundException('Voice session not found');
    return session;
  }

  private async buildInstructions(teamId: string, conversationId: string | null, _voice: RealtimeVoiceId) {
    const cfg = await this.settings.get();
    const lastUser = conversationId
      ? await this.prisma.platformAssistantMessage.findFirst({
          where: { conversationId, role: 'USER' },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const [articles, snapshot, history] = await Promise.all([
      this.knowledge.retrieve(lastUser?.content || 'chatloora'),
      this.context.snapshot(teamId),
      conversationId
        ? this.prisma.platformAssistantMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: 16,
          })
        : Promise.resolve([]),
    ]);
    const kb = articles
      .map((a) => `### ${a.titleAr} / ${a.titleEn}\n${a.bodyAr}\n${a.bodyEn}`)
      .join('\n\n')
      .slice(0, 6000);
    return buildRealtimeVoicePrompt({
      systemPrompt: cfg.systemPrompt,
      knowledge: kb,
      snapshotJson: JSON.stringify(snapshot),
      navigationCatalog: navigationCatalogForPrompt(),
      history: history
        .slice()
        .reverse()
        .map((row) => ({ role: row.role, content: row.content })),
      supportHint: 'إذا طلب موظفاً بشرياً استدعِ أداة request_human_support ولا تقرأ رابطاً. فتح الصفحات لا يعني إنهاء المكالمة.',
    });
  }

  private sessionPayload(model: string, voice: string, instructions: string) {
    return {
      type: 'realtime',
      model,
      instructions,
      tools: REALTIME_TOOLS,
      audio: {
        input: {
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 400,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice },
      },
    };
  }

  private async exchangeSdp(offerSdp: string, sessionConfig: Record<string, unknown>, userId: string) {
    const key = this.openaiKey();
    if (!key) throw new ServiceUnavailableException('تعذر الاتصال بالمساعد الصوتي. حاول مرة أخرى.');
    const safety = createHash('sha256').update(`chatloora:${userId}`).digest('hex');
    const fd = new FormData();
    fd.set('sdp', new Blob([offerSdp], { type: 'application/sdp' }));
    fd.set('session', new Blob([JSON.stringify(sessionConfig)], { type: 'application/json' }));
    const response = await fetch(`${this.openaiBase()}/realtime/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'OpenAI-Safety-Identifier': safety,
        Accept: 'application/sdp',
      },
      body: fd,
    });
    const text = await response.text();
    if (!response.ok || !text.includes('v=0')) {
      this.logger.warn(
        JSON.stringify({
          event: 'REALTIME_SDP_FAILED',
          status: response.status,
          body: openaiErrorSnippet(text),
        }),
      );
      throw new ServiceUnavailableException('تعذر الاتصال بالمساعد الصوتي. حاول مرة أخرى.');
    }
    return text;
  }

  private async mintClientSecret(preferredModel: string, voice: string, instructions: string, userId: string) {
    const key = this.openaiKey();
    if (!key) throw new ServiceUnavailableException('تعذر الاتصال بالمساعد الصوتي. حاول مرة أخرى.');
    const safety = createHash('sha256').update(`chatloora:${userId}`).digest('hex');
    const models = [...new Set([preferredModel, ...REALTIME_MODEL_FALLBACKS])];
    let lastError = '';
    for (const model of models) {
      const payload = {
        session: this.sessionPayload(model, voice, instructions.slice(0, 12000)),
      };
      const response = await fetch(`${this.openaiBase()}/realtime/client_secrets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': safety,
        },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = {};
      }
      const secret = extractClientSecret(parsed);
      if (response.ok && secret) {
        return { secret, model };
      }
      lastError = openaiErrorSnippet(raw);
      this.logger.warn(JSON.stringify({ event: 'REALTIME_SECRET_FAILED', model, status: response.status, body: lastError }));
    }
    throw new ServiceUnavailableException('تعذر الاتصال بالمساعد الصوتي. حاول مرة أخرى.');
  }

  private parseArgs(raw?: string) {
    if (!raw) return {} as Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private async inAppSettings() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'voice-ai.config' } });
    const stored = (row?.value ?? {}) as Record<string, unknown>;
    return {
      inAppRealtimeEnabled: stored.inAppRealtimeEnabled !== false,
      maxInAppCallSec: Number(stored.maxInAppCallSec ?? 600) || 600,
      inAppTranscriptEnabled: stored.inAppTranscriptEnabled !== false,
      defaultInAppVoice: String(stored.defaultInAppVoice ?? stored.femaleVoice ?? 'marin'),
      femaleVoice: String(stored.femaleVoice ?? 'marin'),
      maleVoice: String(stored.maleVoice ?? 'cedar'),
      realtimeModel: String(stored.realtimeModel ?? ''),
    };
  }
}
