import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';

const KEY = 'voice-ai.config';

export type VoicePlatformSettings = {
  enabled: boolean;
  provider: 'twilio';
  defaultLanguage: string;
  defaultVoice: string;
  humanHandoffEnabled: boolean;
  humanHandoffNumber: string;
  recordingEnabled: boolean;
  inAppRealtimeEnabled: boolean;
  realtimeProvider: 'openai';
  realtimeModel: string;
  maleVoice: string;
  femaleVoice: string;
  defaultInAppVoice: string;
  languages: string;
  maxInAppCallSec: number;
  inAppTranscriptEnabled: boolean;
  inAppRecordingEnabled: boolean;
};

export const DEFAULT_VOICE_PLATFORM_SETTINGS: VoicePlatformSettings = {
  enabled: true,
  provider: 'twilio',
  defaultLanguage: 'ar-AE',
  defaultVoice: 'Polly.Zeina',
  humanHandoffEnabled: true,
  humanHandoffNumber: '',
  recordingEnabled: false,
  inAppRealtimeEnabled: true,
  realtimeProvider: 'openai',
  realtimeModel: 'gpt-realtime-2.1',
  maleVoice: 'cedar',
  femaleVoice: 'marin',
  defaultInAppVoice: 'marin',
  languages: 'ar,en',
  maxInAppCallSec: 600,
  inAppTranscriptEnabled: true,
  inAppRecordingEnabled: false,
};

const PLATFORM_GREETING = 'وعليكم السلام، أهلاً وسهلاً بيك في Chatloora. شلون أگدر أساعدك؟';

@Injectable()
export class VoiceAiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(VoiceAiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensurePlatformAgent();
  }

  async getPlatform(): Promise<VoicePlatformSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<VoicePlatformSettings>;
    return {
      ...DEFAULT_VOICE_PLATFORM_SETTINGS,
      ...stored,
      provider: 'twilio',
      realtimeProvider: 'openai',
      enabled: false,
      inAppRealtimeEnabled: false,
      inAppRecordingEnabled: stored.inAppRecordingEnabled === true,
    };
  }

  async updatePlatform(patch: Partial<VoicePlatformSettings>) {
    const current = await this.getPlatform();
    const next: VoicePlatformSettings = {
      ...current,
      ...patch,
      provider: 'twilio',
      realtimeProvider: 'openai',
      inAppRecordingEnabled: (patch.inAppRecordingEnabled ?? current.inAppRecordingEnabled) === true,
    };
    await this.prisma.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, category: 'voice-ai', value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue, category: 'voice-ai' },
    });
    return next;
  }

  async platformAgent() {
    await this.ensurePlatformAgent();
    return this.prisma.voiceAgent.findFirst({ where: { teamId: null }, include: { phoneNumbers: true } });
  }

  private async ensurePlatformAgent() {
    const existing = await this.prisma.voiceAgent.findFirst({ where: { teamId: null } });
    if (existing) {
      await this.syncEnvNumber(existing.id);
      return;
    }
    const agent = await this.prisma.voiceAgent.create({
      data: {
        teamId: null,
        name: 'Chatloora Voice',
        greeting: PLATFORM_GREETING,
        unclearMessage: 'ما سمعتك زين، تكدر تعيد سؤالك؟',
        holdMessage: 'لحظة واحدة لو سمحت.',
        handoffMessage: 'تمام، راح أحولك إلى موظف الدعم.',
      },
    });
    this.logger.log(JSON.stringify({ event: 'VOICE_AGENT_SEEDED', agentId: agent.id }));
    await this.syncEnvNumber(agent.id);
  }

  private async syncEnvNumber(agentId: string) {
    const e164 = this.config.get<string>('TWILIO_PHONE_NUMBER')?.trim();
    if (!e164) return;
    const existing = await this.prisma.voicePhoneNumber.findUnique({ where: { e164 } });
    if (existing) return;
    await this.prisma.voicePhoneNumber.create({
      data: { e164, agentId, teamId: null, provider: 'twilio', isActive: true },
    });
  }
}
