import { createReadStream } from 'fs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@watsapp/database';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { AiProviderService, type AiContentPart } from '../ai/ai-provider.service';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { AssistantContextService } from './assistant-context.service';
import { AssistantKnowledgeService } from './assistant-knowledge.service';
import {
  inferNavigateAction,
  mergeActions,
  navigationCatalogForPrompt,
  parseAssistantActions,
  wantsInAppNavigation,
  type AssistantAction,
} from './assistant-nav';
import { AssistantSettingsService } from './assistant-settings.service';
import { looksUnanswered, supportWhatsAppUrl, wantsHumanSupport } from './assistant.util';

const HISTORY_LIMIT = 16;
const MAX_CONTENT = 4000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type ChatInput = {
  conversationId?: string;
  content?: string;
  file?: UploadedMediaFile;
  speak?: boolean;
};

@Injectable()
export class AssistantChatService {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AssistantSettingsService,
    private readonly knowledge: AssistantKnowledgeService,
    private readonly context: AssistantContextService,
    private readonly gateway: AiGatewayService,
    private readonly provider: AiProviderService,
    private readonly storage: LocalStorageService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 1, lazyConnect: true });
    this.redis.connect().catch(() => undefined);
  }

  async publicConfig() {
    const cfg = await this.settings.get();
    return {
      enabled: cfg.enabled,
      welcomeAr: cfg.welcomeAr,
      welcomeEn: cfg.welcomeEn,
      supportPhone: cfg.supportPhone,
      supportUrl: supportWhatsAppUrl(cfg.supportWhatsApp || cfg.supportPhone),
      suggestions: [
        { id: 'wa', ar: 'كيفية ربط WhatsApp', en: 'How to connect WhatsApp' },
        { id: 'ig', ar: 'كيفية ربط Instagram', en: 'How to connect Instagram' },
        { id: 'pixel', ar: 'كيفية استخدام TikTok Pixel', en: 'How to use TikTok Pixel' },
        { id: 'integration', ar: 'مشكلة في التكامل', en: 'Integration issue' },
        { id: 'billing', ar: 'مشاكل الاشتراك', en: 'Subscription help' },
      ],
    };
  }

  listConversations(teamId: string, userId: string) {
    return this.prisma.platformAssistantConversation.findMany({
      where: { teamId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getConversation(teamId: string, userId: string, id: string) {
    const conversation = await this.prisma.platformAssistantConversation.findFirst({
      where: { id, teamId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 80 } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async deleteConversation(teamId: string, userId: string, id: string) {
    const conversation = await this.prisma.platformAssistantConversation.findFirst({ where: { id, teamId, userId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.prisma.platformAssistantConversation.delete({ where: { id } });
    return { deleted: true };
  }

  async feedback(teamId: string, userId: string, messageId: string, helpful: boolean) {
    const message = await this.prisma.platformAssistantMessage.findFirst({
      where: { id: messageId, conversation: { teamId, userId } },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.platformAssistantMessage.update({
      where: { id: messageId },
      data: { helpful },
    });
  }

  async openMedia(teamId: string, userId: string, messageId: string) {
    const message = await this.prisma.platformAssistantMessage.findFirst({
      where: { id: messageId, conversation: { teamId, userId } },
    });
    if (!message?.mediaUrl) throw new NotFoundException('Media not found');
    return {
      stream: createReadStream(this.storage.resolvePath(message.mediaUrl)),
      mime: message.mediaMime || (message.mediaType === 'IMAGE' ? 'image/jpeg' : 'audio/webm'),
    };
  }

  async speech(teamId: string, text: string) {
    const clean = text.replace(/[`*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 800);
    if (!clean) throw new BadRequestException('Text is required');
    try {
      return await this.provider.speech(teamId, clean);
    } catch {
      throw new ServiceUnavailableException('Voice playback is temporarily unavailable');
    }
  }

  async chat(teamId: string, userId: string, input: ChatInput) {
    const cfg = await this.settings.get();
    if (!cfg.enabled) throw new ForbiddenException('Assistant is disabled');

    let content = (input.content ?? '').trim().slice(0, MAX_CONTENT);
    let mediaType: string | undefined;
    let mediaUrl: string | undefined;
    let mediaMime: string | undefined;
    let imageDataUri: string | undefined;

    if (input.file) {
      const kind = this.classifyUpload(input.file);
      const stored = await this.storage.putBuffer(
        teamId,
        input.file.buffer,
        input.file.mimetype,
        input.file.originalname,
      );
      mediaUrl = stored.storageKey;
      mediaMime = input.file.mimetype.split(';')[0];
      if (kind === 'image') {
        mediaType = 'IMAGE';
        imageDataUri = `data:${mediaMime};base64,${input.file.buffer.toString('base64')}`;
        if (!content) content = 'هذه صورة للمشكلة التي أواجهها في المنصة. حلّل الشاشة وأخبرني ما الخلل وما الحل.';
      } else {
        mediaType = 'AUDIO';
        const transcript = await this.provider.transcribe(teamId, input.file);
        if (!transcript.trim()) throw new BadRequestException('لم أتمكن من فهم البصمة الصوتية. حاول مرة أخرى.');
        content = content ? `${content}\n${transcript.trim()}` : transcript.trim();
      }
    }

    if (!content) throw new BadRequestException('Message is required');

    await this.assertDailyLimit(userId, cfg.dailyLimit);

    let conversation = input.conversationId
      ? await this.prisma.platformAssistantConversation.findFirst({
          where: { id: input.conversationId, teamId, userId },
        })
      : null;
    if (input.conversationId && !conversation) throw new NotFoundException('Conversation not found');
    if (!conversation) {
      conversation = await this.prisma.platformAssistantConversation.create({
        data: { teamId, userId, title: content.slice(0, 80) },
      });
    }

    const userDisplay = mediaType === 'AUDIO' ? `🎤 ${content}` : content;
    await this.prisma.platformAssistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: userDisplay,
        mediaType,
        mediaUrl,
        mediaMime,
      },
    });

    const supportUrl = supportWhatsAppUrl(
      cfg.supportWhatsApp || cfg.supportPhone,
      `مرحباً، أحتاج مساعدة في Chatloora.\nالمشكلة: ${content.slice(0, 280)}`,
    );

    if (wantsHumanSupport(content)) {
      const reply = 'أكيد 🌹 يمكنك التواصل مباشرة مع موظف الدعم عبر WhatsApp، وسيساعدك فريقنا.';
      const saved = await this.saveAssistant(conversation.id, reply, false, []);
      return this.wrapResult(conversation.id, saved, supportUrl, true, content, [], false);
    }

    const [history, articles, snapshot] = await Promise.all([
      this.prisma.platformAssistantMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
      this.knowledge.retrieve(content),
      this.context.snapshot(teamId),
    ]);

    const kb = articles
      .map((a) => `### ${a.titleAr} / ${a.titleEn}\n${a.bodyAr}\n${a.bodyEn}`)
      .join('\n\n')
      .slice(0, 6000);

    const system = `${cfg.systemPrompt}

معرفة المنصة ذات الصلة:
${kb || 'لا توجد مقالة مطابقة؛ اعتمد على حالة الحساب واطلب توضيحاً إن لزم.'}

حالة حساب المستخدم (آمنة، بدون أسرار):
${JSON.stringify(snapshot)}

صفحات المنصة المسموح فتحها للمستخدم (تنقل داخل التطبيق فقط):
${navigationCatalogForPrompt()}

إذا طلب المستخدم فتح قسم أو رابط داخلي، أجب بجملة قصيرة ثم ألحق في نهاية الرد بالضبط:
<<<ACTIONS
[{"type":"navigate","path":"/pricing"}]
ACTIONS>>>
استخدم مساراً واحداً من القائمة أعلاه فقط. لا تفتح /admin ولا روابط خارجية غير واتساب الدعم.
إذا أرسل المستخدم صورة، صف ما يظهر في الشاشة داخل Chatloora وشخص السبب وخطوات الحل.
إذا كانت ميزة غير مفعّلة في الباقة وضّح ذلك واقترح الترقية من صفحة الباقات.`;

    if (!this.gateway.isEnabled()) {
      throw new ServiceUnavailableException('AI temporarily unavailable');
    }

    const model = imageDataUri ? this.visionModel(cfg.model) : cfg.model;
    const historyMessages = history
      .slice()
      .reverse()
      .map((row, index, rows) => {
        const isLastUser = index === rows.length - 1 && row.role === 'USER';
        if (isLastUser && imageDataUri) {
          const parts: AiContentPart[] = [
            { type: 'text', text: content.slice(0, 1500) },
            { type: 'image_url', image_url: { url: imageDataUri } },
          ];
          return { role: 'user' as const, content: parts };
        }
        const prefix = row.mediaType === 'IMAGE' ? '[صورة شاشة] ' : '';
        return {
          role: (row.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `${prefix}${row.content}`.slice(0, 1500),
        };
      });

    let reply: string;
    try {
      const result = await this.gateway.chat({
        model,
        temperature: 0.4,
        maxTokens: 700,
        correlationId: `assistant:${conversation.id}`,
        messages: [{ role: 'system', content: system }, ...historyMessages],
      });
      reply = result.content?.trim() || 'حدث خطأ مؤقت أثناء تشغيل المساعد. حاول مرة أخرى بعد قليل.';
    } catch {
      throw new ServiceUnavailableException('حدث خطأ مؤقت أثناء تشغيل المساعد. حاول مرة أخرى بعد قليل.');
    }

    const parsed = parseAssistantActions(reply);
    const inferred = wantsInAppNavigation(content) ? inferNavigateAction(content) : null;
    const actions = mergeActions(parsed.actions, inferred);
    const unanswered = looksUnanswered(parsed.text);
    const saved = await this.saveAssistant(conversation.id, parsed.text, unanswered, actions);
    await this.prisma.platformAssistantConversation.update({
      where: { id: conversation.id },
      data: { title: conversation.title ?? content.slice(0, 80) },
    });

    return this.wrapResult(
      conversation.id,
      saved,
      supportUrl,
      unanswered,
      content,
      actions,
      Boolean(inferred && actions.length > 0),
    );
  }

  private wrapResult(
    conversationId: string,
    message: { id: string; role: string; content: string; helpful: boolean | null; unanswered: boolean; createdAt: Date; mediaType?: string | null; mediaUrl?: string | null; actions?: Prisma.JsonValue },
    supportUrl: string,
    showSupport: boolean,
    query: string,
    actions: AssistantAction[],
    autoNavigate: boolean,
  ) {
    return {
      conversationId,
      message,
      supportUrl,
      showSupport,
      suggestions: this.nextSuggestions(query),
      actions,
      autoNavigate,
    };
  }

  private visionModel(fallback: string) {
    return (
      this.config.get<string>('AI_VISION_MODEL') ||
      this.config.get<string>('AI_TRANSCRIPTION_CHAT_MODEL') ||
      fallback
    );
  }

  private classifyUpload(file: UploadedMediaFile): 'image' | 'audio' {
    const mime = (file.mimetype || '').split(';')[0].toLowerCase();
    if (IMAGE_TYPES.has(mime) || mime.startsWith('image/')) {
      if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('الصورة أكبر من الحد المسموح.');
      return 'image';
    }
    if (mime.startsWith('audio/') || mime === 'video/webm') {
      if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException('التسجيل الصوتي أكبر من الحد المسموح.');
      return 'audio';
    }
    throw new BadRequestException('نوع الملف غير مدعوم. أرسل صورة أو تسجيلاً صوتياً.');
  }

  private nextSuggestions(query: string) {
    if (/instagram|انستا|إنستغرام/i.test(query)) {
      return [{ ar: 'شلون أفعّل الرد التلقائي على إنستغرام؟', en: 'How do I enable Instagram auto-reply?' }];
    }
    if (/whatsapp|واتساب/i.test(query)) {
      return [{ ar: 'شلون أفعّل الذكاء الاصطناعي على واتساب؟', en: 'How do I enable WhatsApp AI replies?' }];
    }
    if (/pixel|تيك|tiktok|بكسل/i.test(query)) {
      return [{ ar: 'شلون أربط رقم واتساب للتتبع؟', en: 'How do I connect a tracking WhatsApp number?' }];
    }
    return [];
  }

  private async saveAssistant(
    conversationId: string,
    content: string,
    unanswered: boolean,
    actions: AssistantAction[],
  ) {
    return this.prisma.platformAssistantMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content,
        unanswered,
        actions: actions as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async assertDailyLimit(userId: string, dailyLimit: number) {
    const key = `assistant:msgs:${userId}:${new Date().toISOString().slice(0, 10)}`;
    try {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 60 * 60 * 36);
      if (n > dailyLimit) {
        throw new ForbiddenException('لقد وصلت إلى الحد المتاح حالياً لاستخدام المساعد الذكي.');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
    }
  }
}
