import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiVectorService } from './ai-vector.service';

const AUTO_LEARN_TITLE_PREFIX = 'تعلم تلقائي:';
const MIN_QUESTION_CHARS = 8;
const MIN_ANSWER_CHARS = 24;
const DEDUPE_SCORE = 0.88;
const MAX_LEARNS_PER_TEAM_PER_DAY = 40;

/**
 * Self-learning: turn successful customer Q&A into Knowledge Base FAQ chunks
 * so the AI improves automatically from real conversations.
 */
@Injectable()
export class AiAutoLearnService {
  private readonly logger = new Logger(AiAutoLearnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: AiKnowledgeService,
    private readonly vector: AiVectorService,
  ) {}

  /**
   * Learn from a customer question + good AI/human answer.
   * Fire-and-forget safe — never throws to the caller.
   */
  async learnFromExchange(
    teamId: string,
    input: {
      question: string;
      answer: string;
      confidence?: number;
      conversationId?: string;
      source?: 'ai_reply' | 'human_reply';
    },
  ): Promise<{ learned: boolean; reason?: string }> {
    try {
      const question = this.cleanText(input.question);
      const answer = this.cleanText(input.answer);
      if (question.length < MIN_QUESTION_CHARS) {
        return { learned: false, reason: 'question_too_short' };
      }
      if (answer.length < MIN_ANSWER_CHARS) {
        return { learned: false, reason: 'answer_too_short' };
      }
      if (this.looksLikeRefusal(answer)) {
        return { learned: false, reason: 'refusal_or_gap' };
      }
      if (input.confidence != null && input.confidence < 0.65) {
        return { learned: false, reason: 'low_confidence' };
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const learnedToday = await this.prisma.aiKnowledgeDocument.count({
        where: {
          teamId,
          title: { startsWith: AUTO_LEARN_TITLE_PREFIX },
          createdAt: { gte: todayStart },
        },
      });
      if (learnedToday >= MAX_LEARNS_PER_TEAM_PER_DAY) {
        return { learned: false, reason: 'daily_cap' };
      }

      const similar = await this.vector.search(teamId, question, 3);
      const duplicate = similar.find(
        (s) =>
          s.score >= DEDUPE_SCORE &&
          (s.title.startsWith(AUTO_LEARN_TITLE_PREFIX) ||
            s.title.startsWith('FAQ:') ||
            /Question:\s*/i.test(s.content)),
      );
      if (duplicate) {
        return { learned: false, reason: 'duplicate' };
      }

      const shortQ = question.length > 80 ? `${question.slice(0, 77)}…` : question;
      const title = `${AUTO_LEARN_TITLE_PREFIX} ${shortQ}`;
      const content = [
        `Question: ${question}`,
        `Answer: ${answer}`,
        input.source ? `Source: ${input.source}` : null,
        input.conversationId ? `Conversation: ${input.conversationId}` : null,
        `LearnedAt: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join('\n');

      await this.knowledge.ingestText(teamId, {
        title,
        content,
        mimeType: 'text/faq-auto-learn',
      });

      this.logger.log(
        `[AI AutoLearn] learned team=${teamId} q="${shortQ.replace(/\s+/g, ' ').slice(0, 60)}" source=${input.source ?? 'ai_reply'}`,
      );
      return { learned: true };
    } catch (error) {
      this.logger.warn(
        `[AI AutoLearn] failed team=${teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { learned: false, reason: 'error' };
    }
  }

  private cleanText(raw: string): string {
    return String(raw || '')
      .replace(/🎙️/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private looksLikeRefusal(answer: string): boolean {
    return /أحتاج (أن )?(أتحقق|أراجع)|دعني أتحقق|لا أملك (هذه )?المعلومة|I need to check|I don't have (that|enough) information|connecting you to (an )?agent/i.test(
      answer,
    );
  }
}
