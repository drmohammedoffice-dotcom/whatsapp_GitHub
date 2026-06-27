import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiKnowledgeService } from './ai-knowledge.service';

export const AI_TRAINING_DOC_TITLE = '__ai_training_instructions__';

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
  ) {}

  get(teamId: string) {
    return this.ensure(teamId);
  }

  async update(teamId: string, data: Partial<{
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
  }>) {
    await this.ensure(teamId);
    const updated = await this.prisma.aiSettings.update({ where: { teamId }, data: data as never });
    if (data.systemPromptOverride !== undefined) {
      await this.syncTrainingKnowledge(teamId, data.systemPromptOverride);
    }
    return updated;
  }

  private async syncTrainingKnowledge(teamId: string, instructions?: string | null) {
    const content = instructions?.trim();
    const existing = await this.prisma.aiKnowledgeDocument.findFirst({
      where: { teamId, title: AI_TRAINING_DOC_TITLE },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.aiKnowledgeChunk.deleteMany({ where: { documentId: existing.id } });
      await this.prisma.aiKnowledgeDocument.delete({ where: { id: existing.id } });
    }
    if (content) {
      await this.knowledge.ingestText(teamId, { title: AI_TRAINING_DOC_TITLE, content });
    }
  }

  async ensure(teamId: string) {
    return this.prisma.aiSettings.upsert({
      where: { teamId },
      update: {},
      create: { teamId },
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
