import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { AssistantContextService } from '../assistant/assistant-context.service';
import { AssistantKnowledgeService } from '../assistant/assistant-knowledge.service';
import { AssistantSettingsService } from '../assistant/assistant-settings.service';
import { looksUnanswered, supportWhatsAppUrl, wantsHumanSupport } from '../assistant/assistant.util';
import { VOICE_CALL_INSTRUCTIONS, spokenReply, wantsVoiceHandoff } from './voice-ai.util';

export type VoiceHistoryTurn = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class VoiceAiCoreService {
  constructor(
    private readonly settings: AssistantSettingsService,
    private readonly knowledge: AssistantKnowledgeService,
    private readonly context: AssistantContextService,
    private readonly gateway: AiGatewayService,
  ) {}

  async reply(input: { teamId?: string | null; utterance: string; history: VoiceHistoryTurn[] }) {
    const utterance = input.utterance.trim().slice(0, 2000);
    const cfg = await this.settings.get();
    const supportUrl = supportWhatsAppUrl(cfg.supportWhatsApp || cfg.supportPhone);

    if (!utterance) {
      return { reply: 'ما سمعتك زين، تكدر تعيد؟', handoff: false, unanswered: false, supportUrl };
    }

    if (wantsHumanSupport(utterance) || wantsVoiceHandoff(utterance)) {
      return {
        reply: 'أكيد، راح أحولك للدعم البشري هسه.',
        handoff: true,
        unanswered: false,
        supportUrl,
      };
    }

    const [articles, snapshot] = await Promise.all([
      this.knowledge.retrieve(utterance),
      input.teamId ? this.context.snapshot(input.teamId) : Promise.resolve(null),
    ]);

    const kb = articles
      .map((a) => `### ${a.titleAr} / ${a.titleEn}\n${a.bodyAr}\n${a.bodyEn}`)
      .join('\n\n')
      .slice(0, 5000);

    const system = `${cfg.systemPrompt}

${VOICE_CALL_INSTRUCTIONS}

معرفة المنصة ذات الصلة:
${kb || 'لا توجد مقالة مطابقة؛ اطلب توضيحاً إن لزم.'}

${snapshot ? `حالة حساب المتصل (آمنة):\n${JSON.stringify(snapshot)}` : 'هذه مكالمة على رقم Chatloora الرسمي، بدون جلسة مستخدم مسجّلة.'}`;

    if (!this.gateway.isEnabled()) {
      throw new ServiceUnavailableException('AI temporarily unavailable');
    }

    try {
      const result = await this.gateway.chat({
        model: cfg.model,
        temperature: 0.45,
        maxTokens: 280,
        correlationId: `voice:${input.teamId || 'platform'}`,
        messages: [
          { role: 'system', content: system },
          ...input.history.slice(-12).map((row) => ({ role: row.role, content: row.content.slice(0, 800) })),
          { role: 'user', content: utterance },
        ],
      });
      const reply = spokenReply(result.content || '') || 'عذراً، ما قدرت أكمل الفكرة. تحب تعيد سؤالك؟';
      return {
        reply,
        handoff: false,
        unanswered: looksUnanswered(reply),
        supportUrl,
      };
    } catch {
      return {
        reply: 'عذراً، صار عندي خلل بسيط. أگدر أحولك إلى فريق الدعم.',
        handoff: true,
        unanswered: true,
        supportUrl,
      };
    }
  }

  async summarize(transcript: string) {
    const cfg = await this.settings.get();
    if (!this.gateway.isEnabled() || !transcript.trim()) return null;
    try {
      const result = await this.gateway.chat({
        model: cfg.model,
        temperature: 0.2,
        maxTokens: 220,
        correlationId: 'voice:summary',
        messages: [
          {
            role: 'system',
            content: 'لخّص مكالمة دعم Chatloora بالعربية في نقاط قصيرة: اهتمام العميل، المشكلة، النتيجة، وهل طُلب موظف.',
          },
          { role: 'user', content: transcript.slice(0, 6000) },
        ],
      });
      return spokenReply(result.content || '') || null;
    } catch {
      return null;
    }
  }
}
