import { Injectable } from '@nestjs/common';
import { AutomationActionType, AutomationTriggerType, ConversationEventType } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';

export type InboundContext = {
  teamId: string;
  conversationId: string;
  contactId: string;
  messageText?: string | null;
  isNewConversation?: boolean;
};

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService, private readonly settings: AiSettingsService) {}

  list(teamId: string) {
    return this.prisma.automationRule.findMany({ where: { teamId }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] });
  }

  create(teamId: string, data: {
    name: string;
    trigger: AutomationTriggerType;
    action: AutomationActionType;
    conditions?: unknown;
    config?: unknown;
    priority?: number;
    enabled?: boolean;
  }) {
    return this.prisma.automationRule.create({ data: { teamId, ...data } as never });
  }

  update(teamId: string, id: string, data: Partial<{ name: string; enabled: boolean; priority: number; trigger: AutomationTriggerType; action: AutomationActionType; conditions: unknown; config: unknown }>) {
    return this.prisma.automationRule.updateMany({ where: { id, teamId }, data: data as never }).then(() => this.prisma.automationRule.findFirst({ where: { id, teamId } }));
  }

  delete(teamId: string, id: string) {
    return this.prisma.automationRule.deleteMany({ where: { id, teamId } });
  }

  async evaluateInbound(ctx: InboundContext): Promise<Array<{ action: AutomationActionType; message?: string; labelId?: string; assigneeUserId?: string }>> {
    const [rules, aiSettings] = await Promise.all([
      this.prisma.automationRule.findMany({ where: { teamId: ctx.teamId, enabled: true }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }),
      this.settings.ensure(ctx.teamId),
    ]);

    const results: Array<{ action: AutomationActionType; message?: string; labelId?: string; assigneeUserId?: string }> = [];

    const holiday = this.settings.getHolidayMessage(aiSettings);
    if (holiday) {
      results.push({ action: AutomationActionType.SEND_MESSAGE, message: holiday });
      return results;
    }

    const withinHours = this.settings.isWithinBusinessHours(aiSettings);
    if (!withinHours && aiSettings.outOfOfficeMessage) {
      results.push({ action: AutomationActionType.SEND_MESSAGE, message: aiSettings.outOfOfficeMessage });
    }

    for (const rule of rules) {
      if (!this.matchesTrigger(rule.trigger, ctx, withinHours)) continue;
      const config = (rule.config ?? {}) as Record<string, string>;
      switch (rule.action) {
        case AutomationActionType.SEND_GREETING:
          if (ctx.isNewConversation && config.message) results.push({ action: rule.action, message: config.message });
          break;
        case AutomationActionType.SEND_MESSAGE:
          if (config.message) results.push({ action: rule.action, message: config.message });
          break;
        case AutomationActionType.AUTO_TAG:
          if (config.labelId) results.push({ action: rule.action, labelId: config.labelId });
          break;
        case AutomationActionType.AUTO_ASSIGN:
          if (config.assigneeUserId) results.push({ action: rule.action, assigneeUserId: config.assigneeUserId });
          break;
        default:
          break;
      }
    }

    if (ctx.isNewConversation && aiSettings.greetingMessage && !results.some((r) => r.action === AutomationActionType.SEND_GREETING)) {
      results.push({ action: AutomationActionType.SEND_GREETING, message: aiSettings.greetingMessage });
    }

    return results;
  }

  async recordExecution(conversationId: string, action: AutomationActionType, metadata: object) {
    await this.prisma.conversationEvent.create({
      data: { conversationId, type: ConversationEventType.AUTOMATION_EXECUTED, metadata: { action, ...metadata } },
    });
  }

  private matchesTrigger(trigger: AutomationTriggerType, ctx: InboundContext, withinHours: boolean) {
    if (trigger === AutomationTriggerType.CONVERSATION_OPENED) return !!ctx.isNewConversation;
    if (trigger === AutomationTriggerType.MESSAGE_RECEIVED) return true;
    if (trigger === AutomationTriggerType.BUSINESS_HOURS) return withinHours;
    if (trigger === AutomationTriggerType.OUT_OF_OFFICE) return !withinHours;
    return false;
  }
}
