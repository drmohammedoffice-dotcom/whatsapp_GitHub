import { Injectable, Logger } from '@nestjs/common';
import {
  AutomationActionType,
  ChannelProvider,
  ChannelStatus,
  ConversationAiMode,
  ConversationEventType,
  ConversationKind,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { ChannelMessageService } from '../channels/channel-message.service';
import { ChannelSecretsService } from '../channels/channel-secrets.service';
import { OutboundChannelService } from '../channels/outbound-channel.service';
import { BookingsService, CreateBookingInput } from '../bookings/bookings.service';
import { ProductsService } from '../products/products.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AppointmentProfileService } from '../appointments/appointment-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LocalStorageService } from '../storage/local-storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMemoryService } from './ai-memory.service';
import { AiProviderConfigService } from './ai-provider-config.service';
import { AiProviderService } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import { AiTrainingMediaService } from './ai-training-media.service';
import { AiTransferService } from './ai-transfer.service';
import { AutomationService } from './automation.service';
import { ensureWhatsAppPttAudio } from './audio-ptt.util';
import { AiInboundJob } from './ai-inbound.processor';
import { channelProviderToAiPlatform, platformChannelLabel, trainingDocTitle } from './ai-platform';
import { extractJsonObject, extractReplyField, resolveScriptedRepliesForQuestion, normalizeReplyMessages, parseAiDecision } from './ai-transfer-rules';
import { AiAutoLearnService } from './ai-auto-learn.service';
import { AiSubscriptionProofService } from './ai-subscription-proof.service';
import { extractEmails, looksLikePackageChoice } from './ai-subscription-proof';

function isPaymentProofTurn(messageText: string, inboundIsImage: boolean): boolean {
  if (inboundIsImage) return true;
  if (extractEmails(messageText).length > 0) return true;
  // Transfer/receipt language — not package-info questions.
  return /وصل|تحويل|إيصال|ايصال|صورة\s*التحويل|ارسلت\s*(ال)?تحويل|دفعت|حو[ّ']?لت|receipt|transfer|payment\s*proof/i.test(
    messageText,
  );
}

function conversationHasEmailAndReceipt(messages: Array<{
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  mediaStorageKey: string | null;
}>): boolean {
  let hasEmail = false;
  let hasReceipt = false;
  for (const m of messages.slice(0, 40)) {
    if (m.direction !== MessageDirection.INBOUND) continue;
    if (extractEmails(m.text).length) hasEmail = true;
    if (m.type === MessageType.IMAGE && m.mediaStorageKey) hasReceipt = true;
    if (hasEmail && hasReceipt) return true;
  }
  return false;
}

function buildStrictSystemPrompt(platformLabel: string) {
  return `You are the official ${platformLabel} customer support AI for this company.

CRITICAL RULES — NEVER BREAK THESE:
1. Your PRIMARY and MANDATORY source of truth is BUSINESS TRAINING / TRAINING STUDIO (owner-written). Treat every instruction, script, price, link, and wording there as an ORDER — not a suggestion.
2. When Training Studio conflicts with generic rules below, FOLLOW THE TRAINING STUDIO exactly.
3. Also use Knowledge Base, Product Catalog, and Customer Memory only when they add facts that do not contradict Training Studio.
4. NEVER invent, guess, paraphrase, shorten, or rewrite facts from Training Studio. Do NOT add tips, emojis, or explanations that are not in Training Studio when answering from a trained script.
5. If the answer is not in any provided context, politely say you need to check and offer general help — do NOT refuse to reply, and do NOT invent details.
6. MEDIA DECISION — choose the best channel for this reply:
   - Text: default for normal questions.
   - IMAGE / PDF / FILE: if the customer asks for a photo, map, brochure, price list, instructions sheet, or clinic document, look in Product Media Catalog and set sendMediaIds to matching codes (e.g. "M1"). Prefer document/PDF when they ask for ملف/PDF/قائمة أسعار/تعليمات مكتوبة.
   - VOICE: if the customer asks for a voice note / بصمة / رسالة صوتية, OR their request matches a Voice Note Catalog when_to_send (welcome, directions, pre-op, post-op, thank-you, reminder), set sendVoiceIds (e.g. "V1") and prefer voice over a long text reply.
   Use short catalog codes only (M1/V1), never long database ids. You may combine a short text acknowledgement with media/voice when helpful.
7. Reply to EVERY customer message in the conversation. Stay active and helpful throughout the chat.
8. When the customer sends a voice note, the message is prefixed with [بصمة صوتية] followed by the transcribed text (any language: Arabic, English, Iraqi dialect, etc.). Reply naturally in the same language the customer used.
9. BOOKING / ORDER COLLECTION: When the customer wants to place an order or booking, collect phone number, delivery address, order type/description, and total amount.
    - NEVER ask the customer for their name. The customer name is taken automatically from their contact profile when available.
    - If the customer says their phone is the same as their messaging number, or does not provide a phone number, set booking.useWhatsAppPhone=true.
    - When the customer wants a product from MY STORE / متجري catalog, search that catalog first: confirm price, remaining quantity, and in-stock status. Never sell more than quantity. If out of stock, say نفدت الكمية.
    - When they confirm an order for a catalog product, set createBooking=true with booking.productLines (productId from catalog + quantity), orderType as product names, totalAmount as (price × qty) plus delivery if known.
    - When you have address, orderType, and totalAmount, set createBooking=true and fill the booking object.
    - Confirm the order details politely in reply before finalizing.
    - VISION: If the customer sends a product photo, use the Vision match result in the prompt. Tell them the matching store product, price, and stock — or that it is not in the store.
10. When sending media or voice, mention it briefly in your reply when helpful.
11. MULTI-MESSAGE + TARGETED REPLIES (إلزامي 100% من استوديو التدريب):
    - If Training Studio defines "الرسالة الأولى / الثانية / الثالثة…", copy each needed bubble into "replies" CHARACTER-IDENTICAL to Training Studio — zero rewriting, zero deleting of prices/links/numbers/names.
    - Full-details questions (التفاصيل / اشرحلي المنصة / أريد أعرف أكثر): send ALL scripted bubbles in order.
    - Specific questions: send ONLY the bubble that answers the question (e.g. الباقات → الرسالة الثانية فقط, طريقة الاشتراك → الرسالة الثالثة فقط, الفيديو → قسم الفيديو فقط).
    - Never merge two trained bubbles into one WhatsApp message, and never split one trained bubble into many.
    - If a customer question matches any trained section, your "replies" MUST be exact substrings of Training Studio (not a summary).
    - Complete the full JSON object — never cut off mid-JSON.

Return ONLY valid JSON with no markdown:
{"reply":"single bubble OR first bubble","replies":["optional","extra","bubbles"],"shouldTransfer":false,"reason":null,"confidence":0.85,"intent":"brief label","productIds":[],"sendImages":false,"sendMediaIds":[],"sendVoiceIds":[],"createBooking":false,"booking":{"phoneNumber":null,"useWhatsAppPhone":false,"address":null,"orderType":null,"totalAmount":null,"currency":"IQD","notes":null,"productLines":[]},"appointmentAction":null,"appointment":{"serviceId":null,"staffId":null,"slotStart":null,"slotEnd":null,"customerPhone":null,"useWhatsAppPhone":true,"notes":null}}`;
}

function buildSystemPrompt(trainingInstructions?: string | null, platformLabel = 'WhatsApp') {
  const base = buildStrictSystemPrompt(platformLabel);
  const training = trainingInstructions?.trim();
  if (!training) {
    return `${base}\n\n--- BUSINESS TRAINING INSTRUCTIONS ---\n(No Training Studio instructions saved yet. Answer carefully using Knowledge Base / Catalog only.)\n--- END TRAINING INSTRUCTIONS ---`;
  }
  // Training Studio first so the model anchors on owner content before operational JSON rules.
  return `PRIMARY SOURCE OF TRUTH — TRAINING STUDIO (استوديو تدريب الذكاء — written by the business owner).
هذه التعليمات أوامر إلزامية. التزم بها حرفياً بدون حذف أو اختصار أو إعادة صياغة أو إضافة معلومات من عندك.

--- BUSINESS TRAINING INSTRUCTIONS ---
${training}
--- END TRAINING INSTRUCTIONS ---

${base}`;
}

function buildAppointmentPromptAddon(context: string) {
  return `

--- APPOINTMENT SYSTEM (enabled for this business) ---
${context}

APPOINTMENT INTENTS — set intent to one of:
general | book_appointment | reschedule_appointment | cancel_appointment | pricing | staff_info | transfer_human

When the customer wants to book:
1. Ask for service / preferred doctor if unclear.
2. Propose available times using appointmentAction="propose_slots" (do NOT invent times — the system will fill real slots).
3. When the customer confirms a specific ISO time, set appointmentAction="confirm" and fill appointment.slotStart (ISO 8601).
4. To cancel: appointmentAction="cancel".
5. Prefer appointment.useWhatsAppPhone=true unless they give another phone.
6. Use Clinic Knowledge for address, maps, policies, insurance, and visit instructions. Prefer Voice Note Catalog / Product Media Catalog when a recording or file answers better than long text.
7. All times are in the clinic timezone from the context. Never invent clock times outside proposed slots.

appointmentAction values: null | "propose_slots" | "confirm" | "cancel" | "reschedule"
--- END APPOINTMENT SYSTEM ---`;
}

/** Char budget for prompts. Training Studio gets the largest share. */
const PROMPT_CHAR_BUDGET = 18_000;
/** Auto-reply completion budget — open enough for full multi-bubble answers without truncation. */
const AUTO_REPLY_MAX_TOKENS = 3072;
const MAX_TRAINING_CHARS = 16_000;
/** Keep nearly all of the owner’s Training Studio text (incl. 4-message scripts). */
const MAX_TRAINING_CHARS_COMPACT = 14_000;
const MAX_APPOINTMENT_CHARS = 2_200;
const MAX_APPOINTMENT_CHARS_COMPACT = 600;
const MAX_KNOWLEDGE_CHARS = 4_000;
const MAX_MEMORY_CHARS = 1_200;
const MAX_PRODUCTS_CHARS = 3_600;
const MAX_MEDIA_LINES = 12;
const MAX_VOICE_LINES = 10;
const MAX_TRANSCRIPT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 800;
/** Compact auto-reply context caps — catalogs stay usable while Training Studio fits. */
const COMPACT_KB = 1_600;
const COMPACT_MEMORY = 400;
const COMPACT_PRODUCTS = 500;
const COMPACT_MEDIA = 400;
const COMPACT_VOICE = 400;
/** Delay between sequential WhatsApp bubbles (ms) — wait so prior bubble finishes sending. */
const MULTI_REPLY_GAP_MS = 700;

function clipText(value: string | null | undefined, maxChars: number): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function estimateChars(parts: string[]): number {
  return parts.reduce((sum, part) => sum + part.length, 0);
}

function isPromptTooLargeError(error: unknown): boolean {
  const err = error as { message?: string; response?: { status?: number; data?: unknown }; status?: number };
  const status = err?.response?.status ?? err?.status;
  const detail = typeof err?.response?.data === 'string' ? err.response.data : JSON.stringify(err?.response?.data ?? '');
  const blob = `${err?.message ?? ''} ${detail}`;
  // OpenRouter uses 402 for both "prompt tokens limit" and insufficient credits — only retry compact for size.
  return /prompt tokens limit|context.?length|maximum context|too many tokens|token.?limit|Prompt is too long/i.test(
    blob,
  ) || (status === 402 && /prompt|token|context/i.test(blob));
}

type OrchestratorDecision = ReturnType<typeof parseAiDecision> & {
  productIds?: string[];
  sendImages?: boolean;
  sendMediaIds?: string[];
  sendVoiceIds?: string[];
  createBooking?: boolean;
  booking?: CreateBookingInput;
  appointmentAction?: 'propose_slots' | 'confirm' | 'cancel' | 'reschedule' | null;
  appointment?: {
    serviceId?: string | null;
    staffId?: string | null;
    slotStart?: string | null;
    slotEnd?: string | null;
    customerPhone?: string | null;
    useWhatsAppPhone?: boolean;
    notes?: string | null;
  };
};

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  private static readonly SAME_NUMBER_KEYWORDS = [
    'نفس الرقم', 'نفس رقم', 'نفس الواتساب', 'نفس الواتس', 'نفس هذا الرقم', 'نفس رقمي',
    'الرقم نفسه', 'هذا الرقم', 'رقم الواتساب', 'رقمي هو', 'نفسه رقم', 'الواتساب نفسه',
    'same number', 'same as whatsapp', 'whatsapp number', 'this number', 'my whatsapp',
  ];

  private static readonly MEDIA_REQUEST_KEYWORDS = [
    'صور', 'صوره', 'صورة', 'صوار', 'فيديو', 'فديو', 'فيدو', 'مقطع', 'ملف', 'ملفات',
    'اعرض', 'أعرض', 'اعرضل', 'شاهد', 'شوف', 'ورني', 'وريني', 'ارسل', 'أرسل', 'ابعت', 'ابعتل', 'بعتل', 'ريني',
    'photo', 'picture', 'image', 'video', 'file', 'pic', 'send', 'show',
  ];

  private static readonly VOICE_REQUEST_KEYWORDS = [
    'بصمة', 'بصمه', 'رسالة صوتية', 'رسائل صوتية', 'صوتية', 'صوتي', 'تسجيل صوتي', 'فويس',
    'voice note', 'voice message', 'audio message', 'send voice', 'voice reply',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
    private readonly providerConfig: AiProviderConfigService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly provider: AiProviderService,
    private readonly transfer: AiTransferService,
    private readonly automation: AutomationService,
    private readonly channelMessages: ChannelMessageService,
    private readonly channelSecrets: ChannelSecretsService,
    private readonly bookings: BookingsService,
    private readonly appointments: AppointmentsService,
    private readonly appointmentProfile: AppointmentProfileService,
    private readonly trainingMedia: AiTrainingMediaService,
    private readonly outbound: OutboundChannelService,
    private readonly storage: LocalStorageService,
    private readonly whatsapp: WhatsAppService,
    private readonly realtime: RealtimeGateway,
    private readonly entitlements: PlanEntitlementsService,
    private readonly autoLearn: AiAutoLearnService,
    private readonly subscriptionProof: AiSubscriptionProofService,
    private readonly storeProducts: ProductsService,
  ) {}

  async handleInbound(job: AiInboundJob) {
    const stageCtx = {
      teamId: job.teamId,
      conversationId: job.conversationId,
      messageId: job.messageId,
    };
    this.logger.log(`[AI] Incoming message ${JSON.stringify(stageCtx)}`);

    const entitlements = await this.entitlements.getTeamEntitlements(job.teamId);
    if (!entitlements.limits.aiEnabled) {
      this.logger.warn(
        `[AI] Skipped: plan does not allow AI. plan=${entitlements.planSlug} teamId=${job.teamId} conversationId=${job.conversationId}`,
      );
      return;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: job.conversationId, teamId: job.teamId },
      include: {
        contact: { include: { identities: true } },
        channel: { include: { aiAgent: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: MAX_TRANSCRIPT_MESSAGES },
      },
    });
    if (!conversation) {
      this.logger.warn(`[AI] Skipped: conversation not found. ${JSON.stringify(stageCtx)}`);
      return;
    }
    this.logger.log(
      `[AI] Conversation found id=${conversation.id} channelId=${conversation.channelId} aiMode=${conversation.aiMode} provider=${conversation.channel.provider}`,
    );

    const aiPlatform = channelProviderToAiPlatform(conversation.channel.provider);
    const settings = await this.settings.ensure(job.teamId, aiPlatform);
    this.logger.log(
      `[AI] Enabled=${settings.enabled} AutoReply=${settings.autoReplyEnabled} platform=${aiPlatform}`,
    );
    if (!settings.enabled || !settings.autoReplyEnabled) {
      this.logger.warn(
        `[AI] Skipped: AI/auto-reply disabled. enabled=${settings.enabled} autoReply=${settings.autoReplyEnabled} conversationId=${job.conversationId} teamId=${job.teamId}`,
      );
      return;
    }

    if (conversation.aiMode !== ConversationAiMode.AI_ACTIVE) {
      this.logger.warn(
        `[AI] Skipped: conversation aiMode=${conversation.aiMode} (need AI_ACTIVE). conversationId=${job.conversationId}`,
      );
      return;
    }

    if (!(await this.canSendOutbound(conversation.channel))) {
      this.logger.warn(
        `[AI] Skipped: channel cannot send. channelId=${conversation.channelId} status=${conversation.channel.status} provider=${conversation.channel.provider} sessionLive=${conversation.channel.whatsAppSessionId ? this.whatsapp.isSessionLive(conversation.channel.whatsAppSessionId) : false} conversationId=${job.conversationId}`,
      );
      return;
    }

    const runtime = await this.providerConfig.resolveRuntime(job.teamId);
    if (!runtime) {
      this.logger.warn(
        `[AI] Skipped: no AI provider/API key configured. teamId=${job.teamId} conversationId=${job.conversationId}`,
      );
      return;
    }
    this.logger.log(`[AI] Provider ready provider=${runtime.provider} model=${runtime.model}`);

    const automations = await this.automation.evaluateInbound({
      teamId: job.teamId,
      conversationId: job.conversationId,
      contactId: conversation.contactId,
      messageText: job.messageText,
      isNewConversation: job.isNewConversation,
      platform: aiPlatform,
    });

    for (const action of automations) {
      if (action.message) await this.safeSendReply(job.teamId, conversation, action.message);
      if (action.labelId) {
        await this.prisma.conversationTag.upsert({
          where: { conversationId_labelId: { conversationId: job.conversationId, labelId: action.labelId } },
          update: {},
          create: { conversationId: job.conversationId, labelId: action.labelId },
        });
      }
      if (action.assigneeUserId) {
        await this.prisma.conversation.update({ where: { id: job.conversationId }, data: { assigneeUserId: action.assigneeUserId } });
      }
      await this.automation.recordExecution(job.conversationId, action.action, action);
    }

    const holiday = this.settings.getHolidayMessage(settings);
    const withinHours = this.settings.isWithinBusinessHours(settings);
    if (holiday || (!withinHours && settings.outOfOfficeMessage)) {
      const awayMessage = (holiday ?? settings.outOfOfficeMessage)?.trim();
      this.logger.log(
        `[AI] Outside hours/holiday — sending OOO only. holiday=${Boolean(holiday)} withinHours=${withinHours} conversationId=${job.conversationId}`,
      );
      if (awayMessage && !conversation.greetingSentAt) {
        const sent = await this.safeSendReply(job.teamId, conversation, awayMessage);
        if (sent) {
          await this.prisma.conversation.update({ where: { id: job.conversationId }, data: { greetingSentAt: new Date() } });
        }
      }
      return;
    }

    let messageText = job.messageText?.trim();
    if (!messageText) {
      messageText = await this.resolveVoiceMessageText(job);
    }

    const inboundMeta = conversation.messages.find((m) => m.id === job.messageId);
    const inboundIsImage = inboundMeta?.type === MessageType.IMAGE;
    const studioTrainingEarly = settings.systemPromptOverride?.trim() || '';

    // Payment completion (email / receipt / package after both) — else Training Studio scripts win first.
    const paymentTurn =
      isPaymentProofTurn(messageText || '', inboundIsImage) ||
      (looksLikePackageChoice(messageText || '') &&
        conversationHasEmailAndReceipt(conversation.messages));

    if (paymentTurn) {
      const handledProof = await this.subscriptionProof.tryHandle({
        teamId: job.teamId,
        conversation,
        messageId: job.messageId,
        messageText: messageText || '',
        studioTraining: studioTrainingEarly,
        resolveWhatsAppPhone: () => this.resolveCustomerWhatsAppPhone(job.teamId, conversation),
        sendReply: async (text) => {
          if (!(await this.aiReplyStillAllowed(job.teamId, job.conversationId, aiPlatform))) {
            return false;
          }
          return this.safeSendReply(job.teamId, conversation, text);
        },
      });
      if (handledProof) {
        this.logger.log(
          `[AI] Subscription proof flow handled conversationId=${job.conversationId}`,
        );
        return;
      }
    }

    if (!messageText) {
      this.logger.warn(`[AI] Skipped: empty message text. conversationId=${job.conversationId} messageId=${job.messageId}`);
      return;
    }

    // Deterministic Training Studio script BEFORE the LLM — owner wording verbatim.
    const earlyScripted = resolveScriptedRepliesForQuestion(studioTrainingEarly, messageText);
    if (earlyScripted.length >= 1) {
      this.logger.log(
        `[AI] Scripted Training Studio reply bubbles=${earlyScripted.length} conversationId=${job.conversationId}`,
      );
      if (!(await this.aiReplyStillAllowed(job.teamId, job.conversationId, aiPlatform))) {
        this.logger.warn(
          `[AI] Skipped scripted send: AI disabled. conversationId=${job.conversationId}`,
        );
        return;
      }
      let sentAny = false;
      for (let i = 0; i < earlyScripted.length; i++) {
        if (i > 0) {
          if (!(await this.aiReplyStillAllowed(job.teamId, job.conversationId, aiPlatform))) break;
          await new Promise((resolve) => setTimeout(resolve, MULTI_REPLY_GAP_MS));
        }
        const sent = await this.safeSendReply(job.teamId, conversation, earlyScripted[i]!);
        if (sent) sentAny = true;
      }
      if (sentAny) {
        await this.prisma.conversation.update({
          where: { id: job.conversationId },
          data: { lastAiReplyAt: new Date() },
        });
        await this.prisma.conversationEvent.create({
          data: {
            conversationId: job.conversationId,
            type: ConversationEventType.AI_REPLY_SENT,
            metadata: {
              confidence: 1,
              intent: 'scripted_training_reply',
              bubbles: earlyScripted.length,
              source: 'training_studio_script',
            },
          },
        });
        this.realtime.emitTeam(job.teamId, SOCKET_EVENTS.AI_REPLY_SENT, {
          conversationId: job.conversationId,
        });
        this.logger.log(
          `[AI] Scripted reply done conversationId=${job.conversationId} bubbles=${earlyScripted.length}`,
        );
      }
      return;
    }

    this.logger.log(`[AI] Generating AI response for conversationId=${job.conversationId}`);

    const trainingTitle = trainingDocTitle(aiPlatform);
    // Include Training Studio knowledge chunks (synced from Studio) so relevant owner text is retrieved.
    const knowledgeHits = await this.knowledge.search(job.teamId, messageText, 10);
    const trainingHits = knowledgeHits.filter((item) => item.title === trainingTitle);
    const otherHits = knowledgeHits.filter((item) => item.title !== trainingTitle);
    const knowledge = [...trainingHits, ...otherHits].slice(0, 8);
    const knowledgeBlock = clipText(
      knowledge.length
        ? knowledge
            .map((item, i) => {
              const label = item.title === trainingTitle ? 'Training Studio' : item.title;
              return `[${i + 1}] (${label}) ${clipText(item.content, 1200)}`;
            })
            .join('\n---\n')
        : '(No knowledge base entries found)',
      MAX_KNOWLEDGE_CHARS,
    );

    const memoryBlock = clipText(
      runtime.enableMemory
        ? await this.memory.context(job.teamId, { conversationId: job.conversationId, contactId: conversation.contactId })
        : '',
      MAX_MEMORY_CHARS,
    );

    const storeCatalog = await this.storeProducts.catalogForAi(job.teamId, messageText);
    let visionBlock = '';
    if (inboundIsImage && inboundMeta?.mediaStorageKey) {
      visionBlock = await this.matchStoreProductVision(job.teamId, inboundMeta.mediaStorageKey, inboundMeta.mediaMimeType, storeCatalog);
    }
    const productsBlock = clipText(
      [
        storeCatalog.length
          ? storeCatalog
              .slice(0, 30)
              .map(
                (p, i) =>
                  `[P${i + 1}] id=${p.id} name=${p.name} price=${p.price} ${p.currency} qty=${p.quantity} stock=${p.stockLabel} desc=${clipText(p.description, 120)}`,
              )
              .join('\n')
          : '(My Store catalog is empty)',
        visionBlock ? `\nVision analysis:\n${visionBlock}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      MAX_PRODUCTS_CHARS,
    );

    const trainingMedia = await this.trainingMedia.catalog(job.teamId, aiPlatform);
    const wantsMedia = AiOrchestratorService.MEDIA_REQUEST_KEYWORDS.some((k) =>
      messageText.toLowerCase().includes(k.toLowerCase()),
    );
    const mediaBlock = !wantsMedia
      ? '(Media catalog omitted — customer did not ask for photos/files)'
      : trainingMedia.length
        ? trainingMedia
            .slice(0, MAX_MEDIA_LINES)
            .map(
              (m, i) =>
                `M${i + 1} | type=${m.mediaType} | product=${m.productName ?? 'n/a'} | title=${clipText(m.title, 80)} | tags=${clipText(m.tags, 60)} | desc=${clipText(m.description, 120)}`,
            )
            .join('\n')
        : '(No product media uploaded)';

    const voiceNotes = await this.trainingMedia.voiceCatalog(job.teamId, aiPlatform);
    const wantsVoice =
      job.isNewConversation ||
      AiOrchestratorService.VOICE_REQUEST_KEYWORDS.some((k) =>
        messageText.toLowerCase().includes(k.toLowerCase()),
      );
    const voiceBlock = !wantsVoice
      ? '(Voice catalog omitted — customer did not ask for a voice note)'
      : voiceNotes.length
      ? voiceNotes
          .slice(0, MAX_VOICE_LINES)
          .map(
            (m, i) =>
              `V${i + 1} | type=${m.voiceLibraryType ?? 'LIBRARY'} | category=${m.category ?? 'general'} | language=${m.language ?? 'unspecified'} | title=${clipText(m.title, 80)} | tags=${clipText(m.tags, 60)} | when_to_send=${clipText(m.description ?? m.title, 140)}`,
          )
          .join('\n')
      : '(No voice notes uploaded)';

    const transcript = [...conversation.messages]
      .reverse()
      .map((m) => `${m.direction}: ${clipText(m.text ?? String(m.type), MAX_MESSAGE_CHARS)}`)
      .join('\n');
    const channelAgentPrompt = await this.resolveChannelAgentPrompt(job.teamId, conversation.channel);
    const platformLabel = platformChannelLabel(aiPlatform);
    // Training Studio (systemPromptOverride) is always included; channel agent adds on top when set.
    const studioTraining = settings.systemPromptOverride?.trim() || '';
    const channelExtra = channelAgentPrompt?.trim() || '';
    const trainingSource = [studioTraining, channelExtra ? `Channel-specific add-on:\n${channelExtra}` : '']
      .filter(Boolean)
      .join('\n\n');
    if (!studioTraining) {
      this.logger.warn(
        `[AI] No Training Studio instructions saved for platform=${aiPlatform}. teamId=${job.teamId} conversationId=${job.conversationId}`,
      );
    } else {
      this.logger.log(
        `[AI] Using Training Studio chars=${studioTraining.length} channelAddOn=${channelExtra.length} conversationId=${job.conversationId}`,
      );
    }

    // Scripted Training Studio replies already handled earlier — continue to LLM with training as law.
    const appointmentContext = await this.appointmentProfile.buildAiContext(job.teamId);

    const buildSystem = (compact: boolean) => {
      const training = clipText(trainingSource, compact ? MAX_TRAINING_CHARS_COMPACT : MAX_TRAINING_CHARS);
      let prompt = buildSystemPrompt(training, platformLabel);
      if (appointmentContext) {
        const appt = clipText(appointmentContext, compact ? MAX_APPOINTMENT_CHARS_COMPACT : MAX_APPOINTMENT_CHARS);
        prompt = `${prompt}${buildAppointmentPromptAddon(appt)}`;
      }
      if (conversation.kind === ConversationKind.COMMENT) {
        prompt = `${prompt}

PUBLIC POST COMMENT MODE:
- The customer wrote a public comment on an Instagram/Facebook post (not a private DM).
- Your reply is posted publicly under their comment on the post.
- Keep it short (1–3 sentences), friendly, and on-brand. Match the customer's language.
- Do not ask for phone/address or create bookings here unless they explicitly ask in the comment.
- Leave sendMediaIds and sendVoiceIds empty — media/voice cannot be attached to public comment replies.
- Prefer inviting them to DM only when the answer needs private details.`;
      }
      return prompt;
    };

    const buildMessages = (compact: boolean) => {
      const systemPrompt = buildSystem(compact);
      const sys = compact
        ? `${systemPrompt}\n\nKnowledge Base:\n${clipText(knowledgeBlock, COMPACT_KB)}\n\nCustomer Memory:\n${clipText(memoryBlock, COMPACT_MEMORY) || '(none)'}\n\nProduct Catalog:\n${clipText(productsBlock, COMPACT_PRODUCTS)}\n\nProduct Media Catalog:\n${clipText(mediaBlock, COMPACT_MEDIA)}\n\nVoice Note Catalog:\n${clipText(voiceBlock, COMPACT_VOICE)}`
        : `${systemPrompt}\n\nKnowledge Base:\n${knowledgeBlock}\n\nCustomer Memory:\n${memoryBlock || '(none)'}\n\nProduct Catalog:\n${productsBlock}\n\nProduct Media Catalog (when the customer asks for a photo/video/file, put the matching reference codes like M1,M2 into sendMediaIds):\n${mediaBlock}\n\nVoice Note Catalog (when the customer asks for a voice note/بصمة, or their request matches when_to_send, put matching codes like V1 into sendVoiceIds and prefer the voice note over a long text reply):\n${voiceBlock}`;
      const hist = compact
        ? [...conversation.messages]
            .slice(0, 2)
            .reverse()
            .map((m) => `${m.direction}: ${clipText(m.text ?? String(m.type), 120)}`)
            .join('\n')
        : transcript;
      const user = `Conversation history:\n${hist}\n\nLatest customer message:\n${clipText(messageText, MAX_MESSAGE_CHARS)}`;
      const total = estimateChars([sys, user]);
      if (!compact && total > PROMPT_CHAR_BUDGET) {
        return buildMessages(true);
      }
      return [
        { role: 'system' as const, content: sys },
        { role: 'user' as const, content: user },
      ];
    };

    let completion;
    let usedCompact = false;
    // With Training Studio saved: force low temperature and prefer full training when it fits.
    const replyTemperature = studioTraining ? 0 : (runtime.temperature ?? 0.3);
    try {
      const preferCompact =
        !studioTraining ||
        estimateChars([clipText(trainingSource, MAX_TRAINING_CHARS), knowledgeBlock, messageText]) >
          PROMPT_CHAR_BUDGET - 2_000;
      const messages = buildMessages(preferCompact);
      usedCompact = preferCompact;
      const replyMaxTokens = Math.min(runtime.maxTokens ?? AUTO_REPLY_MAX_TOKENS, AUTO_REPLY_MAX_TOKENS);
      this.logger.log(
        `[AI] Calling AI provider model=${runtime.model} promptChars≈${estimateChars(messages.map((m) => String(m.content)))} compact=${usedCompact} temp=${replyTemperature} maxTokens=${replyMaxTokens} conversationId=${job.conversationId}`,
      );
      completion = await this.provider.chat(job.teamId, messages, {
        model: runtime.model,
        temperature: replyTemperature,
        maxTokens: replyMaxTokens,
        topP: runtime.topP,
        json: true,
        persistUntilSuccess: true,
        correlationId: job.conversationId,
      });
    } catch (error) {
      const detail = (error as { response?: { data?: unknown } })?.response?.data;
      this.logger.error(
        `[AI] Provider failed. Reason=${error instanceof Error ? error.message : String(error)} teamId=${job.teamId} conversationId=${job.conversationId}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (detail) this.logger.error(`[AI] Provider response: ${JSON.stringify(detail).slice(0, 800)}`);

      if (isPromptTooLargeError(error)) {
        this.logger.warn(`[AI] Prompt too large — retrying compact context. conversationId=${job.conversationId}`);
        try {
          const compactMessages = buildMessages(true);
          this.logger.log(
            `[AI] Calling AI Provider (compact) promptChars≈${estimateChars(compactMessages.map((m) => String(m.content)))} conversationId=${job.conversationId}`,
          );
          completion = await this.provider.chat(job.teamId, compactMessages, {
            model: runtime.model,
            temperature: replyTemperature,
            maxTokens: Math.min(runtime.maxTokens ?? AUTO_REPLY_MAX_TOKENS, AUTO_REPLY_MAX_TOKENS),
            topP: runtime.topP,
            json: true,
            persistUntilSuccess: true,
            correlationId: `${job.conversationId}:compact`,
          });
          usedCompact = true;
        } catch (retryError) {
          this.logger.error(
            `[AI] Compact retry failed. Reason=${retryError instanceof Error ? retryError.message : String(retryError)} conversationId=${job.conversationId} teamId=${job.teamId}`,
            retryError instanceof Error ? retryError.stack : undefined,
          );
          // Re-throw so BullMQ retries — never silently drop auto-reply while AI is enabled.
          throw retryError;
        }
      } else {
        // Transient provider errors: re-throw so the inbound queue retries.
        // AI Gateway already failed over across all keys; queue backoff continues the attempt.
        throw error;
      }
    }

    this.logger.log(
      `[AI] Response received provider=${completion.provider} model=${completion.model} promptTokens=${completion.promptTokens} completionTokens=${completion.completionTokens} compact=${usedCompact} conversationId=${job.conversationId}`,
    );

    const decision = this.parseOrchestratorDecision(completion.content);

    // Some providers/models return empty content when forced into JSON mode.
    // Fall back to a plain-text completion so the customer still gets a reply.
    if (!normalizeReplyMessages(decision).length) {
      this.logger.warn(
        `[AI] Empty JSON reply. provider=${completion.provider} model=${completion.model} contentLen=${completion.content?.length ?? 0} rawHead=${JSON.stringify((completion.content ?? '').slice(0, 200))}. Retrying plain-text.`,
      );
      try {
        const plainMessages = buildMessages(true);
        plainMessages[0] = {
          role: 'system',
          content: `${clipText(buildSystem(true), MAX_TRAINING_CHARS_COMPACT)}\n\nKnowledge Base:\n${clipText(knowledgeBlock, 2500)}\n\nReply using Training Studio wording verbatim when it answers the question. Plain text only (no JSON, no markdown). If Training Studio asks for separate messages, separate bubbles with a line containing only --- . Do not truncate useful details.`,
        };
        const plain = await this.provider.chat(job.teamId, plainMessages, {
          model: runtime.model,
          temperature: replyTemperature,
          maxTokens: Math.min(runtime.maxTokens ?? AUTO_REPLY_MAX_TOKENS, AUTO_REPLY_MAX_TOKENS),
          topP: runtime.topP,
          json: false,
          persistUntilSuccess: true,
          correlationId: `${job.conversationId}:plain`,
        });
        const plainReply = plain.content?.trim();
        if (plainReply) {
          decision.reply = plainReply;
          decision.replies = undefined;
        }
      } catch (error) {
        this.logger.error(
          `[AI] Plain-text fallback failed. Reason=${error instanceof Error ? error.message : String(error)} teamId=${job.teamId} conversationId=${job.conversationId}`,
        );
      }
    }

    let replyMessages = normalizeReplyMessages(decision);
    // Last-line defense: never send orchestrator JSON to WhatsApp.
    replyMessages = replyMessages
      .map((bubble) => {
        if (bubble.startsWith('{') && /"reply"\s*:|"replies"\s*:|"shouldTransfer"\s*:/.test(bubble)) {
          return extractReplyField(bubble)?.trim() ?? '';
        }
        return bubble;
      })
      .filter(Boolean);

    // If Training Studio has a matching scripted bubble, replace LLM paraphrase with verbatim text.
    if (studioTraining) {
      const forced = resolveScriptedRepliesForQuestion(studioTraining, messageText);
      if (forced.length >= 1) {
        this.logger.log(
          `[AI] Overriding LLM reply with Training Studio script bubbles=${forced.length} conversationId=${job.conversationId}`,
        );
        replyMessages = forced;
      }
    }

    if (!replyMessages.length) {
      this.logger.warn(
        `[AI] Empty reply after parse — retrying plain-text. conversationId=${job.conversationId}`,
      );
      try {
        const plainMessages = buildMessages(true);
        plainMessages[0] = {
          role: 'system',
          content: `${clipText(buildSystem(true), MAX_TRAINING_CHARS_COMPACT)}\n\nKnowledge Base:\n${clipText(knowledgeBlock, 2500)}\n\nReply using Training Studio wording verbatim when it answers the question. Plain text only (no JSON, no markdown). Do not truncate useful details. Separate multiple WhatsApp bubbles with a line containing only --- .`,
        };
        const plain = await this.provider.chat(job.teamId, plainMessages, {
          model: runtime.model,
          temperature: replyTemperature,
          maxTokens: Math.min(runtime.maxTokens ?? AUTO_REPLY_MAX_TOKENS, AUTO_REPLY_MAX_TOKENS),
          topP: runtime.topP,
          json: false,
          persistUntilSuccess: true,
          correlationId: `${job.conversationId}:plain2`,
        });
        const recovered = plain.content?.trim() ?? '';
        if (recovered.startsWith('{') && /"reply"\s*:/.test(recovered)) {
          replyMessages = normalizeReplyMessages({
            reply: extractReplyField(recovered) ?? '',
          });
        } else {
          replyMessages = normalizeReplyMessages({ reply: recovered });
        }
      } catch (error) {
        this.logger.error(
          `[AI] Plain-text recovery failed. Reason=${error instanceof Error ? error.message : String(error)} conversationId=${job.conversationId}`,
        );
      }
    }

    let replyText = replyMessages.join('\n\n');
    if (appointmentContext && decision.appointmentAction) {
      try {
        const handled = await this.handleAppointmentDecision(job.teamId, conversation, decision, messageText);
        if (handled?.replyAddon) {
          const addon = handled.replyAddon.trim();
          if (addon) {
            replyMessages = [...replyMessages, addon];
            replyText = replyMessages.join('\n\n');
          }
        }
      } catch (error) {
        this.logger.warn(
          `[Appointments] AI action failed conversationId=${job.conversationId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (decision.createBooking && decision.booking) {
      try {
        const whatsAppPhone = await this.resolveCustomerWhatsAppPhone(job.teamId, conversation);
        const wantsSameNumber = this.customerWantsWhatsAppPhone(messageText);
        const booking = await this.bookings.createFromAi(job.teamId, conversation, decision.booking, {
          whatsAppPhone,
          forceWhatsAppPhone: wantsSameNumber,
        });
        if (booking) {
          try {
            const lines = await this.storeProducts.resolveSaleLines(job.teamId, {
              productIds: decision.productIds,
              productLines: decision.booking.productLines,
            });
            if (lines.length) await this.storeProducts.applySale(job.teamId, lines, booking.id);
          } catch (stockError) {
            this.logger.warn(
              `Store stock decrement failed for booking ${booking.orderNumber}: ${stockError instanceof Error ? stockError.message : String(stockError)}`,
            );
          }
          const confirm = `✅ تم تثبيت طلبك بنجاح\nرقم الطلب: ${booking.orderNumber}\nالهاتف: ${booking.phoneNumber}\nالعنوان: ${booking.address}\nالنوع: ${booking.orderType}\nالمبلغ: ${booking.totalAmount} ${booking.currency}`;
          replyMessages = [...replyMessages, confirm];
          replyText = replyMessages.join('\n\n');
        }
      } catch (error) {
        this.logger.warn(`Failed to create booking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const isPublicComment = conversation.kind === ConversationKind.COMMENT;
    const voiceToSend = isPublicComment
      ? []
      : this.resolveVoiceNotesToSend(voiceNotes, decision.sendVoiceIds, messageText);
    const mediaToSend = isPublicComment
      ? []
      : this.resolveMediaToSend(trainingMedia, decision.sendMediaIds, messageText);

    // Prefer voice note when matched — avoid long text + voice duplication.
    if (voiceToSend.length && replyText?.trim() && replyText.trim().length > 120) {
      replyMessages = ['🎙️'];
      replyText = '🎙️';
    }

    // The user may have switched AI off while we were waiting on the provider
    // (gateway failover/retries can take minutes). Re-check the kill switches
    // right before sending so a disabled chat never receives an AI reply.
    if (!(await this.aiReplyStillAllowed(job.teamId, job.conversationId, aiPlatform))) {
      this.logger.warn(
        `[AI] Skipped send: AI was disabled while generating the reply. conversationId=${job.conversationId} teamId=${job.teamId}`,
      );
      return;
    }

    if (replyMessages.length) {
      // Public comment replies: one short bubble only (IG/FB comment thread).
      if (isPublicComment && replyMessages.length > 1) {
        replyMessages = [replyMessages[0]!];
        replyText = replyMessages[0]!;
      }
      this.logger.log(
        `[AI] Saving + sending ${replyMessages.length} WhatsApp bubble(s) conversationId=${job.conversationId}`,
      );
      let sentAny = false;
      for (let i = 0; i < replyMessages.length; i++) {
        if (i > 0) {
          if (!(await this.aiReplyStillAllowed(job.teamId, job.conversationId, aiPlatform))) {
            this.logger.warn(
              `[AI] Stopped multi-reply mid-loop (AI disabled). sent=${i}/${replyMessages.length} conversationId=${job.conversationId}`,
            );
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, MULTI_REPLY_GAP_MS));
        }
        const sent = await this.safeSendReply(job.teamId, conversation, replyMessages[i]!);
        if (sent) sentAny = true;
      }
      if (sentAny) this.logger.log(`[AI] WhatsApp message(s) sent conversationId=${job.conversationId}`);
      if (!sentAny && !voiceToSend.length && !mediaToSend.length) {
        this.logger.error(`[AI] Failed to send reply and no media/voice fallback. conversationId=${job.conversationId}`);
        return;
      }

      // Self-learning: only when no Training Studio (avoid poisoning owner scripts with paraphrases).
      if (sentAny && !decision.shouldTransfer && replyText !== '🎙️' && !studioTraining) {
        void this.autoLearn.learnFromExchange(job.teamId, {
          question: messageText,
          answer: replyText,
          confidence: decision.confidence,
          conversationId: job.conversationId,
          source: 'ai_reply',
        });
      }
    } else if (!voiceToSend.length && !mediaToSend.length) {
      this.logger.warn(`[AI] Skipped send: empty reply and no media/voice. conversationId=${job.conversationId}`);
      return;
    }

    if (voiceToSend.length) {
      this.logger.log(
        `[AI] Sending ${voiceToSend.length} voice note(s) conversationId=${job.conversationId} ids=${JSON.stringify(decision.sendVoiceIds ?? [])}`,
      );
      await this.sendTrainingMedia(job.teamId, conversation, voiceToSend, { asVoiceNote: true });
    }

    if (mediaToSend.length) {
      this.logger.log(
        `[AI] Sending ${mediaToSend.length} training media item(s) conversationId=${job.conversationId} ids=${JSON.stringify(decision.sendMediaIds ?? [])}`,
      );
      await this.sendTrainingMedia(job.teamId, conversation, mediaToSend);
    }

    if (runtime.enableImageSending && decision.sendImages && decision.productIds?.length) {
      await this.sendProductImages(job.teamId, conversation, decision.productIds);
    }

    await this.prisma.conversation.update({ where: { id: job.conversationId }, data: { lastAiReplyAt: new Date() } });
    await this.prisma.conversationEvent.create({
      data: {
        conversationId: job.conversationId,
        type: ConversationEventType.AI_REPLY_SENT,
        metadata: { confidence: decision.confidence, intent: decision.intent, provider: completion.provider, model: completion.model },
      },
    });
    this.realtime.emitTeam(job.teamId, SOCKET_EVENTS.AI_REPLY_SENT, { conversationId: job.conversationId });
    this.logger.log(`[AI] Done conversationId=${job.conversationId} teamId=${job.teamId}`);
  }

  /** Transcribe an inbound WhatsApp voice note so the AI can read and reply to it. */
  private async resolveVoiceMessageText(job: AiInboundJob): Promise<string | undefined> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const inbound = await this.prisma.conversationMessage.findFirst({
        where: { id: job.messageId, teamId: job.teamId, conversationId: job.conversationId },
      });
      if (!inbound || inbound.type !== MessageType.AUDIO) return undefined;

      if (!inbound.mediaStorageKey) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        this.logger.warn(`Voice note ${inbound.id} has no media file — cannot transcribe`);
        return undefined;
      }

      try {
        const buffer = await this.outbound.readMediaBuffer(inbound.mediaStorageKey);
        const transcription = await this.provider.transcribe(job.teamId, {
          buffer,
          originalname: inbound.mediaFileName ?? 'voice.ogg',
          mimetype: inbound.mediaMimeType ?? 'audio/ogg',
        });
        const text = transcription?.trim();
        if (!text) return undefined;

        await this.prisma.conversationMessage.update({
          where: { id: inbound.id },
          data: { text },
        });
        this.logger.log(`Transcribed voice note ${inbound.id}: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`);
        return `[بصمة صوتية] ${text}`;
      } catch (error) {
        this.logger.warn(
          `Voice transcription attempt ${attempt + 1}/4 failed for message ${job.messageId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    return undefined;
  }

  private parseOrchestratorDecision(raw: string): OrchestratorDecision {
    const json = extractJsonObject(raw);
    if (json) {
      try {
        const parsed = JSON.parse(json) as OrchestratorDecision & { replies?: unknown };
        const base = parseAiDecision(raw);
        return {
          ...base,
          replies: base.replies,
          productIds: Array.isArray(parsed.productIds) ? parsed.productIds.map(String) : [],
          sendImages: Boolean(parsed.sendImages),
          sendMediaIds: Array.isArray(parsed.sendMediaIds) ? parsed.sendMediaIds.map(String) : [],
          sendVoiceIds: Array.isArray(parsed.sendVoiceIds) ? parsed.sendVoiceIds.map(String) : [],
          createBooking: Boolean(parsed.createBooking),
          booking: parsed.booking && typeof parsed.booking === 'object' ? (parsed.booking as CreateBookingInput) : undefined,
          appointmentAction:
            parsed.appointmentAction === 'propose_slots' ||
            parsed.appointmentAction === 'confirm' ||
            parsed.appointmentAction === 'cancel' ||
            parsed.appointmentAction === 'reschedule'
              ? parsed.appointmentAction
              : null,
          appointment: parsed.appointment && typeof parsed.appointment === 'object' ? parsed.appointment : undefined,
        };
      } catch {
        /* fall through */
      }
    }
    return {
      ...parseAiDecision(raw),
      productIds: [],
      sendImages: false,
      sendMediaIds: [],
      sendVoiceIds: [],
      createBooking: false,
      appointmentAction: null,
    };
  }

  private async handleAppointmentDecision(
    teamId: string,
    conversation: {
      id: string;
      contactId: string;
      channelId: string;
      channel: { whatsAppSessionId: string | null };
      contact: { displayName: string; phone?: string | null; identities: Array<{ channelId: string; externalId: string }> };
    },
    decision: OrchestratorDecision,
    messageText: string,
  ): Promise<{ replyAddon?: string } | null> {
    const action = decision.appointmentAction;
    if (!action) return null;

    if (action === 'propose_slots') {
      const slots = await this.appointments.getAvailableSlots(teamId, {
        serviceId: decision.appointment?.serviceId ?? undefined,
      });
      if (!slots.slots.length) {
        return { replyAddon: 'عذراً، لا توجد مواعيد متاحة حالياً. يرجى المحاولة لاحقاً أو التحدث مع موظف.' };
      }
      const lines = slots.slots
        .slice(0, 5)
        .map((s, i) => `${i + 1}) ${s.label}\n   (${s.start})`)
        .join('\n');
      return {
        replyAddon: `المواعيد المتاحة القادمة:\n${lines}\n\nيرجى الرد برقم الخيار أو وقت الموعد المطلوب.`,
      };
    }

    if (action === 'confirm') {
      const slotStart = decision.appointment?.slotStart
        ? new Date(decision.appointment.slotStart)
        : null;
      if (!slotStart || Number.isNaN(slotStart.getTime())) {
        return { replyAddon: 'لم أتمكن من تحديد وقت الموعد. يرجى اختيار وقت من القائمة المقترحة.' };
      }
      const phone =
        decision.appointment?.useWhatsAppPhone !== false
          ? (await this.resolveCustomerWhatsAppPhone(teamId, conversation)) ??
            decision.appointment?.customerPhone ??
            conversation.contact.phone
          : decision.appointment?.customerPhone;
      if (!phone) {
        return { replyAddon: 'أحتاج رقم هاتف لتأكيد الموعد.' };
      }
      const created = await this.appointments.createFromAi({
        teamId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        customerPhone: phone,
        customerName: conversation.contact.displayName,
        startsAt: slotStart,
        endsAt: decision.appointment?.slotEnd ? new Date(decision.appointment.slotEnd) : undefined,
        staffId: decision.appointment?.staffId,
        serviceId: decision.appointment?.serviceId,
        notes: decision.appointment?.notes ?? messageText.slice(0, 200),
      });
      if (!created) return { replyAddon: 'تعذر إنشاء الموعد حالياً.' };
      const profile = await this.appointmentProfile.ensure(teamId);
      return { replyAddon: this.appointments.confirmationMessage(created, profile.timezone) };
    }

    if (action === 'cancel') {
      const upcoming = await this.prisma.appointment.findFirst({
        where: {
          teamId,
          conversationId: conversation.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: 'asc' },
      });
      if (!upcoming) return { replyAddon: 'لا يوجد موعد قادم مرتبط بهذه المحادثة لإلغائه.' };
      await this.appointments.cancel(teamId, upcoming.id, 'Cancelled via AI WhatsApp');
      return { replyAddon: 'تم إلغاء موعدك بنجاح.' };
    }

    if (action === 'reschedule') {
      const slots = await this.appointments.getAvailableSlots(teamId, {
        serviceId: decision.appointment?.serviceId ?? undefined,
      });
      const lines = slots.slots
        .slice(0, 5)
        .map((s, i) => `${i + 1}) ${s.label}`)
        .join('\n');
      return {
        replyAddon: `لإعادة الجدولة، اختر موعداً جديداً:\n${lines || 'لا توجد أوقات متاحة حالياً.'}`,
      };
    }

    return null;
  }

  private async matchStoreProductVision(
    teamId: string,
    storageKey: string,
    mimeType: string | null | undefined,
    catalog: Array<{ id: string; name: string; price: number; currency: string; quantity: number; inStock: boolean; description: string | null }>,
  ): Promise<string> {
    if (!catalog.length) return '(Customer sent a photo but My Store has no products to match.)';
    try {
      const buffer = await this.outbound.readMediaBuffer(storageKey);
      if (!buffer?.length) return '(Could not read the customer photo.)';
      const mime = (mimeType || 'image/jpeg').split(';')[0]!.trim() || 'image/jpeg';
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      const list = catalog
        .slice(0, 25)
        .map((p, i) => `${i + 1}. id=${p.id} | ${p.name} | ${p.price} ${p.currency} | ${p.inStock ? `qty ${p.quantity}` : 'OUT OF STOCK'} | ${clipText(p.description, 80)}`)
        .join('\n');
      const completion = await this.provider.chat(
        teamId,
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Match this customer product photo to MY STORE catalog. Return ONLY JSON:
{"matched":true|false,"productId":"id or null","productName":"string or null","confidence":0-1,"reason":"short Arabic note"}
Catalog:
${list}
If it is not clearly one of these products, matched=false.`,
              },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        { json: true, temperature: 0, maxTokens: 300, persistUntilSuccess: true, correlationId: `store-vision:${teamId}` },
      );
      const raw = completion.content?.trim() || '';
      return clipText(raw, 500);
    } catch (error) {
      this.logger.warn(`Store vision failed: ${error instanceof Error ? error.message : String(error)}`);
      return '(Vision analysis failed — ask the customer for the product name.)';
    }
  }

  private async resolveCustomerWhatsAppPhone(
    teamId: string,
    conversation: {
      channelId: string;
      channel: { whatsAppSessionId: string | null };
      contact: { phone?: string | null; identities: Array<{ channelId: string; externalId: string }> };
    },
  ): Promise<string | null> {
    const identity =
      conversation.contact.identities.find((i) => i.channelId === conversation.channelId) ??
      conversation.contact.identities[0];
    const sessionId = conversation.channel.whatsAppSessionId;
    if (identity && sessionId) {
      const resolved = await this.whatsapp.resolvePhoneNumber(teamId, sessionId, identity.externalId);
      if (resolved) return resolved;
    }
    const fromContact = conversation.contact.phone?.trim();
    if (fromContact && !fromContact.includes('@')) return fromContact.replace(/[^\d+]/g, '');
    return null;
  }

  private customerWantsWhatsAppPhone(messageText: string): boolean {
    const normalized = messageText.toLowerCase();
    return AiOrchestratorService.SAME_NUMBER_KEYWORDS.some((k) => normalized.includes(k));
  }

  private resolveMediaToSend(
    catalog: Array<{ id: string; productName: string | null; title: string; tags: string | null; description?: string | null }>,
    aiRefs: string[] | undefined,
    messageText: string,
  ): string[] {
    if (!catalog.length) return [];
    const result = new Set<string>();

    for (const ref of aiRefs ?? []) {
      const raw = String(ref).trim();
      const byId = catalog.find((m) => m.id === raw);
      if (byId) {
        result.add(byId.id);
        continue;
      }
      const match = /^M?\s*(\d+)$/i.exec(raw);
      if (match) {
        const idx = Number(match[1]) - 1;
        if (catalog[idx]) result.add(catalog[idx].id);
      }
    }

    const normalized = messageText.toLowerCase();
    const wantsMedia = AiOrchestratorService.MEDIA_REQUEST_KEYWORDS.some((k) => normalized.includes(k));
    if (wantsMedia) {
      const matchedByKeyword: string[] = [];
      for (const m of catalog) {
        const haystack = [m.productName, m.title, m.tags, m.description]
          .filter(Boolean)
          .flatMap((s) => String(s).toLowerCase().split(/[\s,،/|._-]+/))
          .filter((tk) => tk.length >= 3);
        if (haystack.some((tk) => normalized.includes(tk))) matchedByKeyword.push(m.id);
      }
      if (matchedByKeyword.length) {
        matchedByKeyword.forEach((id) => result.add(id));
      } else if (!result.size && catalog.length <= 3) {
        catalog.forEach((m) => result.add(m.id));
      }
    }

    return [...result];
  }

  private resolveVoiceNotesToSend(
    catalog: Array<{ id: string; title: string; tags: string | null; description?: string | null }>,
    aiRefs: string[] | undefined,
    messageText: string,
  ): string[] {
    if (!catalog.length) return [];
    const result = new Set<string>();

    for (const ref of aiRefs ?? []) {
      const raw = String(ref).trim();
      const byId = catalog.find((m) => m.id === raw);
      if (byId) {
        result.add(byId.id);
        continue;
      }
      const match = /^V?\s*(\d+)$/i.exec(raw);
      if (match) {
        const idx = Number(match[1]) - 1;
        if (catalog[idx]) result.add(catalog[idx].id);
      }
    }

    const normalized = messageText.toLowerCase();
    const wantsVoice = AiOrchestratorService.VOICE_REQUEST_KEYWORDS.some((k) => normalized.includes(k));

    const matchedByKeyword: string[] = [];
    for (const m of catalog) {
      const haystack = [m.title, m.tags, m.description]
        .filter(Boolean)
        .flatMap((s) => String(s).toLowerCase().split(/[\s,،/|._-]+/))
        .filter((tk) => tk.length >= 3);
      if (haystack.some((tk) => normalized.includes(tk))) matchedByKeyword.push(m.id);
    }

    if (matchedByKeyword.length) {
      matchedByKeyword.forEach((id) => result.add(id));
    } else if (wantsVoice && !result.size && catalog.length === 1) {
      result.add(catalog[0].id);
    }

    return [...result];
  }

  private async sendTrainingMedia(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      channel: { whatsAppSessionId: string | null };
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    mediaIds: string[],
    options?: { asVoiceNote?: boolean },
  ) {
    if (!conversation.channel.whatsAppSessionId || !mediaIds.length) return;
    const identity = conversation.contact.identities.find((i) => i.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) return;

    const uniqueIds = [...new Set(mediaIds)];
    for (const mediaId of uniqueIds) {
      const loaded = await this.trainingMedia.readBuffer(teamId, mediaId);
      if (!loaded) continue;
      const { row, buffer } = loaded;
      try {
        let payload: Record<string, unknown>;
        let messageType: MessageType;
        if (row.mediaType === 'IMAGE') {
          payload = { image: buffer, caption: row.title, mimetype: row.mimeType };
          messageType = MessageType.IMAGE;
        } else if (row.mediaType === 'VIDEO') {
          payload = { video: buffer, caption: row.title, mimetype: row.mimeType };
          messageType = MessageType.VIDEO;
        } else if (row.mediaType === 'AUDIO') {
          const asPtt = Boolean(options?.asVoiceNote || row.isVoiceNote);
          const audio = asPtt
            ? await ensureWhatsAppPttAudio(buffer, row.mimeType || 'audio/ogg; codecs=opus')
            : { buffer, mimeType: row.mimeType || 'audio/ogg; codecs=opus' };
          payload = {
            audio: audio.buffer,
            mimetype: audio.mimeType,
            ptt: asPtt,
          };
          messageType = MessageType.AUDIO;
        } else {
          payload = {
            document: buffer,
            fileName: row.fileName ?? `${row.title}.bin`,
            mimetype: row.mimeType,
            caption: row.title,
          };
          messageType = MessageType.DOCUMENT;
        }
        const response = await this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, payload);
        await this.channelMessages.ingest({
          teamId,
          channelId: conversation.channelId,
          externalIdentityId: identity.externalId,
          displayName: conversation.contact.displayName,
          providerMessageId: response?.key?.id,
          direction: MessageDirection.OUTBOUND,
          type: messageType,
          status: MessageStatus.SENT,
          text: row.title,
          payload: response ?? {},
          occurredAt: new Date(),
        });
      } catch (error) {
        this.logger.warn(`Failed to send training media ${mediaId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async sendProductImages(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      channel: { whatsAppSessionId: string | null };
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    productIds: string[],
  ) {
    if (!conversation.channel.whatsAppSessionId) return;
    const identity = conversation.contact.identities.find((i) => i.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) return;

    const products = await this.prisma.product.findMany({
      where: { teamId, id: { in: productIds }, isActive: true },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });

    for (const product of products) {
      const image = product.images[0];
      if (!image?.url) continue;
      try {
        const response = await this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, {
          image: { url: image.url },
          caption: product.name,
        });
        await this.channelMessages.ingest({
          teamId,
          channelId: conversation.channelId,
          externalIdentityId: identity.externalId,
          displayName: conversation.contact.displayName,
          providerMessageId: response?.key?.id,
          direction: MessageDirection.OUTBOUND,
          type: MessageType.IMAGE,
          status: MessageStatus.SENT,
          text: product.name,
          payload: response ?? {},
          occurredAt: new Date(),
        });
      } catch (error) {
        this.logger.warn(`Failed to send product image for ${product.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async resolveChannelAgentPrompt(
    teamId: string,
    channel: { aiAgentId: string | null; aiAgent?: { enabled: boolean; systemPrompt: string } | null; whatsAppCloudAccountId: string | null },
  ): Promise<string | null> {
    if (channel.aiAgent?.enabled) return channel.aiAgent.systemPrompt;
    if (channel.aiAgentId && !channel.aiAgent) {
      const agent = await this.prisma.aiAgent.findFirst({
        where: { id: channel.aiAgentId, teamId, enabled: true },
      });
      if (agent) return agent.systemPrompt;
    }
    if (channel.whatsAppCloudAccountId) {
      const account = await this.prisma.whatsAppCloudAccount.findFirst({
        where: { id: channel.whatsAppCloudAccountId, teamId },
        include: { aiAgent: true },
      });
      if (account?.aiAgent?.enabled) return account.aiAgent.systemPrompt;
    }
    return null;
  }

  private async canSendOutbound(channel: {
    id: string;
    provider: ChannelProvider;
    status: ChannelStatus;
    metadata: unknown;
    whatsAppSessionId: string | null;
    whatsAppCloudAccountId?: string | null;
    telegramConnectionId?: string | null;
  }): Promise<boolean> {
    if (channel.provider === ChannelProvider.WHATSAPP_BAILEYS) {
      const sessionId = channel.whatsAppSessionId;
      if (!sessionId) return false;

      const live = this.whatsapp.isSessionLive(sessionId);
      // Channel row can lag as CONNECTING after reconnect while the socket is already live.
      // Prefer the live socket over the stale DB status so AI replies are not silently dropped.
      if (live) {
        if (channel.status !== ChannelStatus.CONNECTED) {
          void this.prisma.channel
            .updateMany({
              where: { id: channel.id, status: { not: ChannelStatus.CONNECTED } },
              data: { status: ChannelStatus.CONNECTED },
            })
            .catch(() => undefined);
          void this.prisma.whatsAppSession
            .updateMany({
              where: { id: sessionId, status: { not: 'CONNECTED' } },
              data: { status: 'CONNECTED' },
            })
            .catch(() => undefined);
          this.logger.warn(
            `[AI] Healed WhatsApp channel ${channel.id} status ${channel.status}→CONNECTED (session live)`,
          );
        }
        return true;
      }

      // Socket not in this process — still allow when DB says CONNECTED (send path may reconnect).
      if (channel.status === ChannelStatus.CONNECTED) {
        this.logger.warn(
          `[AI] WhatsApp session ${sessionId} not live in-process; attempting outbound anyway (status=CONNECTED)`,
        );
        return true;
      }
      return false;
    }
    if (channel.provider === ChannelProvider.WHATSAPP_CLOUD) {
      return Boolean(channel.whatsAppCloudAccountId);
    }
    if (channel.provider === ChannelProvider.TELEGRAM_USER) {
      return Boolean(channel.telegramConnectionId);
    }
    if (
      channel.provider === ChannelProvider.TELEGRAM ||
      channel.provider === ChannelProvider.META_MESSENGER ||
      channel.provider === ChannelProvider.META_INSTAGRAM
    ) {
      if (channel.status !== ChannelStatus.CONNECTED) return false;
      const token = await this.channelSecrets.getAccessToken(channel.id);
      return Boolean(token);
    }
    return false;
  }

  /**
   * Fresh gate check right before sending. Long provider waits (gateway
   * failover, queue retries) must not override a toggle the user flipped off.
   */
  private async aiReplyStillAllowed(
    teamId: string,
    conversationId: string,
    aiPlatform: Parameters<AiSettingsService['ensure']>[1],
  ): Promise<boolean> {
    const [settings, freshConversation] = await Promise.all([
      this.settings.ensure(teamId, aiPlatform),
      this.prisma.conversation.findFirst({
        where: { id: conversationId, teamId },
        select: { aiMode: true },
      }),
    ]);
    if (!settings.enabled || !settings.autoReplyEnabled) return false;
    if (!freshConversation || freshConversation.aiMode !== ConversationAiMode.AI_ACTIVE) return false;
    return true;
  }

  private async safeSendReply(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      kind?: ConversationKind;
      metadata?: unknown;
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    text: string,
  ): Promise<boolean> {
    try {
      await this.sendReply(teamId, conversation, text);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send AI reply for conversation ${conversation.id} on channel ${conversation.channelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async sendReply(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      kind?: ConversationKind;
      metadata?: unknown;
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    text: string,
  ) {
    // Never push an empty bubble to the customer — skip when the AI produced no text.
    const body = text?.trim();
    if (!body) {
      this.logger.warn(`Skipped empty AI reply for conversation ${conversation.id}`);
      return;
    }
    const identity = conversation.contact.identities.find((i) => i.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) return;
    const response = await this.outbound.sendText(teamId, conversation.id, body);
    const kind = conversation.kind ?? ConversationKind.DIRECT_MESSAGE;
    const meta =
      conversation.metadata && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : undefined;
    await this.channelMessages.ingest({
      teamId,
      channelId: conversation.channelId,
      externalIdentityId: identity.externalId,
      displayName: conversation.contact.displayName,
      providerMessageId: response?.key?.id,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      text: body,
      payload: response ?? {},
      occurredAt: new Date(),
      kind,
      conversationMetadata: meta,
    });
  }
}
