import { Injectable } from '@nestjs/common';
import { AiAgentType } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiChatDto, AiTextTaskDto } from './dto/ai.dto';
import { AiCostService } from './ai-cost.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMemoryService } from './ai-memory.service';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiAssistantService {
  constructor(private readonly prisma: PrismaService, private readonly provider: AiProviderService, private readonly knowledge: AiKnowledgeService, private readonly memory: AiMemoryService, private readonly costs: AiCostService, private readonly audit: AuditService) {}

  async chat(teamId: string, userId: string | undefined, dto: AiChatDto) {
    const context = dto.useKnowledge ? await this.knowledge.search(teamId, dto.message) : [];
    const memory = dto.conversationId ? await this.memory.context(teamId, { conversationId: dto.conversationId }) : await this.memory.context(teamId, {});
    return this.run(teamId, userId, 'chat', [
      { role: 'system', content: `You are an enterprise customer communication AI. Use only supplied context when answering business facts.\nMemory:\n${memory}\nKnowledge:\n${context.map((item) => item.content).join('\n---\n')}` },
      { role: 'user', content: dto.message },
    ], dto.conversationId);
  }

  async conversationTask(teamId: string, userId: string | undefined, conversationId: string, task: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, teamId }, include: { contact: true, messages: { orderBy: { createdAt: 'asc' }, take: 50 } } });
    const transcript = conversation?.messages.map((m) => `${m.direction}: ${m.text ?? m.type}`).join('\n') ?? '';
    return this.run(teamId, userId, task, [
      { role: 'system', content: 'You analyze and assist customer service conversations. Return concise, directly usable output.' },
      { role: 'user', content: `${task}\nCustomer: ${conversation?.contact.displayName}\nTranscript:\n${transcript}` },
    ], conversationId);
  }

  rewrite(teamId: string, userId: string | undefined, dto: AiTextTaskDto) {
    return this.run(teamId, userId, 'rewrite', [{ role: 'system', content: `Rewrite the message for a customer support agent. Tone: ${dto.tone ?? 'professional'}.` }, { role: 'user', content: dto.text }]);
  }

  translate(teamId: string, userId: string | undefined, dto: AiTextTaskDto) {
    return this.run(teamId, userId, 'translate', [{ role: 'system', content: `Translate to ${dto.targetLanguage ?? 'English'} preserving meaning and formatting.` }, { role: 'user', content: dto.text }]);
  }

  classify(teamId: string, userId: string | undefined, task: string, text: string) {
    return this.run(teamId, userId, task, [{ role: 'system', content: 'Return strict JSON with keys: label, confidence, rationale. Do not include markdown.' }, { role: 'user', content: `${task}: ${text}` }], undefined, true);
  }

  private async run(teamId: string, userId: string | undefined, task: string, messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>, conversationId?: string, json = false) {
    const run = await this.prisma.aiRun.create({ data: { teamId, userId, task, conversationId, status: 'RUNNING', input: { messages } } });
    try {
      const completion = await this.provider.chat(teamId, messages, { json });
      const cost = await this.costs.record({ teamId, provider: completion.provider, model: completion.model, operation: task, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens });
      const updated = await this.prisma.aiRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', output: { content: completion.content }, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens, costCents: cost.costCents } });
      await this.audit.log({ teamId, actorUserId: userId, action: 'ai.run', resource: 'aiRun', resourceId: updated.id, metadata: { task, conversationId, promptTokens: completion.promptTokens, completionTokens: completion.completionTokens, costCents: cost.costCents } });
      return { runId: updated.id, content: completion.content };
    } catch (error) {
      await this.prisma.aiRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'AI run failed' } });
      throw error;
    }
  }
}
