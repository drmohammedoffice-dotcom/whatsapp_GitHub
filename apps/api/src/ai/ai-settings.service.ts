import { Injectable } from '@nestjs/common';
import { AiTrainingPlatform } from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { parseAiTrainingPlatform, trainingDocTitle } from './ai-platform';

export type BusinessHoursConfig = {
  timezone?: string;
  schedule?: Array<{ day: number; open: string; close: string }>;
};

export type HolidayReply = { date: string; message: string };

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: AiKnowledgeService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  get(teamId: string, platform: AiTrainingPlatform = AiTrainingPlatform.WHATSAPP) {
    return this.ensure(teamId, platform);
  }

  async update(
    teamId: string,
    data: Partial<{
      enabled: boolean;
      autoReplyEnabled: boolean;
      confidenceThreshold: number;
      greetingMessage: string | null;
      outOfOfficeMessage: string | null;
      businessHours: BusinessHoursConfig | null;
      holidayReplies: HolidayReply[] | null;
      transferOnLowConfidence: boolean;
      transferOnComplaint: boolean;
      transferOnRefund: boolean;
      transferOnSensitive: boolean;
      transferOnHumanRequest: boolean;
      customTransferRules: unknown;
      pauseAiOnHumanReply: boolean;
      pauseAiOnAssignment: boolean;
      monthlyBudgetCents: number | null;
      systemPromptOverride: string | null;
    }> & { platform?: AiTrainingPlatform },
  ) {
    const platform = parseAiTrainingPlatform(data.platform);
    const { platform: _ignored, ...patch } = data;
    // Inbox toggles often flip only autoReplyEnabled — keep `enabled` in sync so
    // the orchestrator gate (!enabled || !autoReply) does not silently block replies.
    if (patch.autoReplyEnabled === true && patch.enabled === undefined) {
      patch.enabled = true;
    }
    if (patch.enabled === false && patch.autoReplyEnabled === undefined) {
      patch.autoReplyEnabled = false;
    }
    if (patch.enabled === true || patch.autoReplyEnabled === true) {
      await this.entitlements.assertAiEnabled(teamId);
    }
    await this.ensure(teamId, platform);
    const updated = await this.prisma.aiSettings.update({
      where: { teamId_platform: { teamId, platform } },
      data: patch as never,
    });
    if (data.systemPromptOverride !== undefined) {
      await this.syncTrainingKnowledge(teamId, platform, data.systemPromptOverride);
    }
    return updated;
  }

  private async syncTrainingKnowledge(
    teamId: string,
    platform: AiTrainingPlatform,
    instructions?: string | null,
  ) {
    const title = trainingDocTitle(platform);
    const content = instructions?.trim();
    const existing = await this.prisma.aiKnowledgeDocument.findFirst({
      where: { teamId, title },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.aiKnowledgeChunk.deleteMany({ where: { documentId: existing.id } });
      await this.prisma.aiKnowledgeDocument.delete({ where: { id: existing.id } });
    }
    if (content) {
      await this.knowledge.ingestText(teamId, { title, content });
    }
  }

  async ensure(teamId: string, platform: AiTrainingPlatform = AiTrainingPlatform.WHATSAPP) {
    return this.prisma.aiSettings.upsert({
      where: { teamId_platform: { teamId, platform } },
      update: {},
      create: { teamId, platform },
    });
  }

  isWithinBusinessHours(settings: { businessHours?: unknown | null }, now = new Date()) {
    const config = (settings.businessHours ?? {}) as BusinessHoursConfig;
    if (!config.schedule?.length) return true;
    const tz = config.timezone ?? 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '');
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const current = hour * 60 + minute;
    const slot = config.schedule.find((s) => s.day === weekday);
    if (!slot) return false;
    const [openH, openM] = slot.open.split(':').map(Number);
    const [closeH, closeM] = slot.close.split(':').map(Number);
    const open = openH * 60 + openM;
    const close = closeH * 60 + closeM;
    return current >= open && current < close;
  }

  getHolidayMessage(settings: { holidayReplies?: unknown | null }, now = new Date()) {
    const holidays = (settings.holidayReplies ?? []) as HolidayReply[];
    const today = now.toISOString().slice(0, 10);
    return holidays.find((h) => h.date === today)?.message ?? null;
  }
}
