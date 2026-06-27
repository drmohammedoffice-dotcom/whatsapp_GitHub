import { Injectable, Logger } from '@nestjs/common';
import {
  AiTransferReason,
  AutomationActionType,
  ConversationAiMode,
  ConversationEventType,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { ChannelMessageService } from '../channels/channel-message.service';
import { OutboundChannelService } from '../channels/outbound-channel.service';
import { BookingsService, CreateBookingInput } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
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
import { AiInboundJob } from './ai-inbound.processor';
import { applyTransferRules, parseAiDecision } from './ai-transfer-rules';

const STRICT_SYSTEM_PROMPT = `You are the official WhatsApp support AI for this company.

CRITICAL RULES — NEVER BREAK THESE:
1. Answer using facts from Business Training Instructions, Knowledge Base, Product Catalog, or Customer Memory below.
2. Follow the Business Training Instructions for tone, mission, product details, and how to reply to customers.
3. NEVER invent, guess, or hallucinate information that contradicts the provided context.
4. If the answer is not in any provided context, politely say you need to check and offer general help — do NOT refuse to reply.
5. If the customer explicitly asks for a human, agent, or representative, set shouldTransfer=true and reason="CUSTOMER_REQUEST".
6. If the message is a serious complaint or expresses strong anger, set shouldTransfer=true and reason="COMPLAINT".
7. If the message requests a refund or return, set shouldTransfer=true and reason="REFUND_REQUEST".
8. If the message involves sensitive legal, medical, or personal safety issues, set shouldTransfer=true and reason="SENSITIVE_ISSUE".
9. If the customer asks to see a product image/video/file (e.g. "أرسل صورة", "اريد صور المنتج", "show me a photo/video"), look in Product Media Catalog and set sendMediaIds to the matching reference codes. Use the short reference code shown at the start of each catalog line (e.g. "M1", "M2") — NOT the long id. Example: "sendMediaIds":["M1"]. If several items match the requested product, include all their codes.
10. Reply to EVERY customer message in the conversation. Stay active and helpful throughout the chat.
11. BOOKING / ORDER COLLECTION: When the customer wants to place an order or booking, collect phone number, delivery address, order type/description, and total amount.
    - NEVER ask the customer for their name. The customer name is taken automatically from their WhatsApp contact, so do not request it.
    - If the customer says their phone is the same as WhatsApp, or does not provide a phone number, set booking.useWhatsAppPhone=true.
    - When you have address, orderType, and totalAmount, set createBooking=true and fill the booking object.
    - Confirm the order details politely in reply before finalizing.
12. When sending media, mention it in your reply (e.g. "sending product photos now").

When shouldTransfer=true, reply must politely explain you are connecting them to a human agent.

Return ONLY valid JSON with no markdown:
{"reply":"customer message","shouldTransfer":false,"reason":null,"confidence":0.85,"intent":"brief label","productIds":[],"sendImages":false,"sendMediaIds":[],"createBooking":false,"booking":{"phoneNumber":null,"useWhatsAppPhone":false,"address":null,"orderType":null,"totalAmount":null,"currency":"IQD","notes":null}}`;

function buildSystemPrompt(trainingInstructions?: string | null) {
  const training = trainingInstructions?.trim();
  if (!training) return STRICT_SYSTEM_PROMPT;
  return `${STRICT_SYSTEM_PROMPT}\n\n--- BUSINESS TRAINING INSTRUCTIONS (set by business owner — follow these closely) ---\n${training}\n--- END TRAINING INSTRUCTIONS ---`;
}

type OrchestratorDecision = ReturnType<typeof parseAiDecision> & {
  productIds?: string[];
  sendImages?: boolean;
  sendMediaIds?: string[];
  createBooking?: boolean;
  booking?: CreateBookingInput;
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
    private readonly bookings: BookingsService,
    private readonly trainingMedia: AiTrainingMediaService,
    private readonly outbound: OutboundChannelService,
    private readonly storage: LocalStorageService,
    private readonly whatsapp: WhatsAppService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async handleInbound(job: AiInboundJob) {
    const settings = await this.settings.ensure(job.teamId);
    if (!settings.enabled || !settings.autoReplyEnabled) return;

    const runtime = await this.providerConfig.resolveRuntime(job.teamId);
    if (!runtime) {
      this.logger.warn(`No AI provider configured for team ${job.teamId}`);
      return;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: job.conversationId, teamId: job.teamId },
      include: { contact: { include: { identities: true } }, channel: true, messages: { orderBy: { createdAt: 'desc' }, take: 12 } },
    });
    if (!conversation) return;

    if (conversation.aiMode !== ConversationAiMode.AI_ACTIVE) return;
    if (settings.pauseAiOnAssignment && conversation.assigneeUserId) {
      await this.transfer.pauseAi(job.teamId, job.conversationId);
      return;
    }

    const automations = await this.automation.evaluateInbound({
      teamId: job.teamId,
      conversationId: job.conversationId,
      contactId: conversation.contactId,
      messageText: job.messageText,
      isNewConversation: job.isNewConversation,
    });

    for (const action of automations) {
      if (action.message) await this.sendReply(job.teamId, conversation, action.message);
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
      if (!conversation.greetingSentAt) {
        await this.prisma.conversation.update({ where: { id: job.conversationId }, data: { greetingSentAt: new Date() } });
      }
      return;
    }

    let messageText = job.messageText?.trim();
    if (!messageText) {
      const inbound = await this.prisma.conversationMessage.findFirst({
        where: { id: job.messageId, teamId: job.teamId, conversationId: job.conversationId },
      });
      if (inbound?.type === MessageType.AUDIO && inbound.mediaStorageKey) {
        try {
          const buffer = await this.outbound.readMediaBuffer(inbound.mediaStorageKey);
          messageText = await this.provider.transcribe(job.teamId, {
            buffer,
            originalname: inbound.mediaFileName ?? 'voice.ogg',
            mimetype: inbound.mediaMimeType ?? 'audio/ogg',
          });
          if (messageText?.trim()) {
            await this.prisma.conversationMessage.update({
              where: { id: inbound.id },
              data: { text: messageText.trim() },
            });
          }
        } catch (error) {
          this.logger.warn(`Voice transcription failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (!messageText) return;

    const knowledge = await this.knowledge.search(job.teamId, messageText);
    const knowledgeBlock = knowledge.length
      ? knowledge.map((item, i) => `[${i + 1}] ${item.content}`).join('\n---\n')
      : '(No knowledge base entries found)';

    const memoryBlock = runtime.enableMemory
      ? await this.memory.context(job.teamId, { conversationId: job.conversationId, contactId: conversation.contactId })
      : '';

    const products = runtime.enableProductSearch ? await this.searchProducts(job.teamId, messageText) : [];
    const productsBlock = products.length
      ? products.map((p, i) => `[P${i + 1}] id=${p.id} name=${p.name} price=${p.priceCents ?? 'n/a'} ${p.currency} category=${p.category ?? 'n/a'} desc=${p.description ?? ''}`).join('\n')
      : '(No matching products)';

    const trainingMedia = await this.trainingMedia.catalog(job.teamId);
    const mediaBlock = trainingMedia.length
      ? trainingMedia.map((m, i) => `M${i + 1} | type=${m.mediaType} | product=${m.productName ?? 'n/a'} | title=${m.title} | tags=${m.tags ?? ''} | desc=${m.description ?? ''}`).join('\n')
      : '(No product media uploaded)';

    const transcript = [...conversation.messages].reverse().map((m) => `${m.direction}: ${m.text ?? m.type}`).join('\n');
    const hasTraining = Boolean(settings.systemPromptOverride?.trim());
    const systemPrompt = buildSystemPrompt(settings.systemPromptOverride);

    let completion;
    try {
      completion = await this.provider.chat(
        job.teamId,
        [
          {
            role: 'system',
            content: `${systemPrompt}\n\nKnowledge Base:\n${knowledgeBlock}\n\nCustomer Memory:\n${memoryBlock || '(none)'}\n\nProduct Catalog:\n${productsBlock}\n\nProduct Media Catalog (when the customer asks for a photo/video/file, put the matching reference codes like M1,M2 into sendMediaIds):\n${mediaBlock}`,
          },
          { role: 'user', content: `Conversation history:\n${transcript}\n\nLatest customer message:\n${messageText}` },
        ],
        {
          model: runtime.model,
          temperature: runtime.temperature,
          maxTokens: runtime.maxTokens,
          topP: runtime.topP,
          json: true,
        },
      );
    } catch (error) {
      this.logger.error(`AI provider failed for team ${job.teamId}: ${error instanceof Error ? error.message : String(error)}`);
      if (runtime.enableHumanHandover) {
        await this.transfer.transfer({
          teamId: job.teamId,
          conversationId: job.conversationId,
          reason: AiTransferReason.LOW_CONFIDENCE,
          confidence: 0,
          customerMessage: messageText,
        });
      }
      return;
    }

    const decision = this.parseOrchestratorDecision(completion.content);
    const finalDecision = runtime.enableHumanHandover
      ? applyTransferRules(decision, settings, messageText, knowledge.length === 0, hasTraining)
      : { ...decision, shouldTransfer: false };

    if (finalDecision.shouldTransfer) {
      const reason = finalDecision.reason ?? AiTransferReason.LOW_CONFIDENCE;
      if (finalDecision.reply) await this.sendReply(job.teamId, conversation, finalDecision.reply);
      await this.transfer.transfer({
        teamId: job.teamId,
        conversationId: job.conversationId,
        reason,
        confidence: finalDecision.confidence,
        customerMessage: messageText,
      });
      return;
    }

    let replyText = finalDecision.reply;

    if (decision.createBooking && decision.booking) {
      try {
        const whatsAppPhone = await this.resolveCustomerWhatsAppPhone(job.teamId, conversation);
        const wantsSameNumber = this.customerWantsWhatsAppPhone(messageText);
        const booking = await this.bookings.createFromAi(job.teamId, conversation, decision.booking, {
          whatsAppPhone,
          forceWhatsAppPhone: wantsSameNumber,
        });
        if (booking) {
          replyText = `${replyText}\n\n✅ تم تثبيت طلبك بنجاح\nرقم الطلب: ${booking.orderNumber}\nالهاتف: ${booking.phoneNumber}\nالعنوان: ${booking.address}\nالنوع: ${booking.orderType}\nالمبلغ: ${booking.totalAmount} ${booking.currency}`.trim();
        }
      } catch (error) {
        this.logger.warn(`Failed to create booking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await this.sendReply(job.teamId, conversation, replyText);

    const mediaToSend = this.resolveMediaToSend(trainingMedia, decision.sendMediaIds, messageText);
    if (mediaToSend.length) {
      this.logger.log(`Sending ${mediaToSend.length} training media item(s) for conversation ${job.conversationId} (ai=${JSON.stringify(decision.sendMediaIds ?? [])})`);
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
        metadata: { confidence: finalDecision.confidence, intent: finalDecision.intent, provider: completion.provider, model: completion.model },
      },
    });
    this.realtime.emitTeam(job.teamId, SOCKET_EVENTS.AI_REPLY_SENT, { conversationId: job.conversationId });
  }

  private parseOrchestratorDecision(raw: string): OrchestratorDecision {
    try {
      const parsed = JSON.parse(raw) as OrchestratorDecision;
      return {
        ...parseAiDecision(raw),
        productIds: Array.isArray(parsed.productIds) ? parsed.productIds.map(String) : [],
        sendImages: Boolean(parsed.sendImages),
        sendMediaIds: Array.isArray(parsed.sendMediaIds) ? parsed.sendMediaIds.map(String) : [],
        createBooking: Boolean(parsed.createBooking),
        booking: parsed.booking && typeof parsed.booking === 'object' ? (parsed.booking as CreateBookingInput) : undefined,
      };
    } catch {
      return { ...parseAiDecision(raw), productIds: [], sendImages: false, sendMediaIds: [], createBooking: false };
    }
  }

  private async searchProducts(teamId: string, query: string) {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (!terms.length) {
      return this.prisma.product.findMany({ where: { teamId, isActive: true }, include: { images: { orderBy: { position: 'asc' }, take: 3 } }, take: 5, orderBy: { viewCount: 'desc' } });
    }
    return this.prisma.product.findMany({
      where: {
        teamId,
        isActive: true,
        OR: terms.flatMap((term) => [
          { name: { contains: term, mode: 'insensitive' as const } },
          { description: { contains: term, mode: 'insensitive' as const } },
          { category: { contains: term, mode: 'insensitive' as const } },
        ]),
      },
      include: { images: { orderBy: { position: 'asc' }, take: 3 } },
      take: 8,
    });
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

  private async sendTrainingMedia(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      channel: { whatsAppSessionId: string | null };
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    mediaIds: string[],
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
          payload = { audio: buffer, mimetype: row.mimeType };
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

  private async sendReply(
    teamId: string,
    conversation: {
      id: string;
      channelId: string;
      contact: { displayName: string; identities: Array<{ channelId: string; externalId: string }> };
    },
    text: string,
  ) {
    const identity = conversation.contact.identities.find((i) => i.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) return;
    const response = await this.outbound.sendText(teamId, conversation.id, text);
    await this.channelMessages.ingest({
      teamId,
      channelId: conversation.channelId,
      externalIdentityId: identity.externalId,
      displayName: conversation.contact.displayName,
      providerMessageId: response?.key?.id,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      text,
      payload: response ?? {},
      occurredAt: new Date(),
    });
  }
}
