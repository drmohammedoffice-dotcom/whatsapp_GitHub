import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  ConversationEventType,
  MessageDirection,
  MessageType,
} from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { BookingsService } from '../bookings/bookings.service';
import { SubscriptionActivationService } from '../billing/subscription-activation.service';
import { OutboundChannelService } from '../channels/outbound-channel.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiProviderService } from './ai-provider.service';
import {
  amountMatchesPackage,
  buildSubscriptionAmountMismatchMessage,
  buildSubscriptionAskEmailMessage,
  buildSubscriptionAskPackageMessage,
  buildSubscriptionAskReceiptMessage,
  buildSubscriptionOrderNotes,
  buildSubscriptionRejectReceiptMessage,
  buildSubscriptionThankYouMessage,
  buildSubscriptionUserNotFoundMessage,
  detectSubscriptionPackage,
  extractEmails,
  extractMastercardFromTraining,
  inferPackageFromAmount,
  looksLikePackageChoice,
  looksLikeSubscriptionProofTurn,
  parseVisionReceiptVerdict,
  type SubscriptionPackage,
  type VisionReceiptVerdict,
} from './ai-subscription-proof';

type ProofConversation = {
  id: string;
  contactId: string;
  channelId: string;
  contact: {
    phone?: string | null;
    displayName: string;
    email?: string | null;
    identities: Array<{ channelId: string; externalId: string }>;
  };
  messages: Array<{
    id: string;
    direction: MessageDirection;
    type: MessageType;
    text: string | null;
    mediaStorageKey: string | null;
    mediaMimeType: string | null;
    mediaFileName: string | null;
    createdAt: Date;
  }>;
};

@Injectable()
export class AiSubscriptionProofService {
  private readonly logger = new Logger(AiSubscriptionProofService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly outbound: OutboundChannelService,
    private readonly bookings: BookingsService,
    private readonly realtime: RealtimeGateway,
    private readonly activation: SubscriptionActivationService,
  ) {}

  /**
   * Handles email + transfer-receipt subscription turns.
   * Returns true when this service fully handled the inbound job (caller should return).
   */
  async tryHandle(input: {
    teamId: string;
    conversation: ProofConversation;
    messageId: string;
    messageText: string;
    studioTraining: string;
    resolveWhatsAppPhone: () => Promise<string | null | undefined>;
    sendReply: (text: string) => Promise<boolean>;
  }): Promise<boolean> {
    const inbound = await this.loadInboundMessage(input.teamId, input.conversation.id, input.messageId);
    if (!inbound) return false;

    const isImage = inbound.type === MessageType.IMAGE;
    if (isImage && !inbound.mediaStorageKey) {
      // Media download may still be in flight.
      const waited = await this.waitForMediaKey(input.teamId, input.conversation.id, input.messageId);
      if (waited?.mediaStorageKey) {
        inbound.mediaStorageKey = waited.mediaStorageKey;
        inbound.mediaMimeType = waited.mediaMimeType;
        inbound.mediaFileName = waited.mediaFileName;
      }
    }

    const inboundTextBlob = this.collectInboundText(input.conversation, input.messageText);
    const currentEmails = [
      ...extractEmails(input.messageText),
      ...extractEmails(inbound.text),
    ];
    const hasCurrentEmail = currentEmails.length > 0;
    const chatEmail = currentEmails[0] || this.findRecentInboundEmail(input.conversation);
    const email = chatEmail;

    const receipt =
      isImage && inbound.mediaStorageKey
        ? inbound
        : this.findRecentInboundReceipt(input.conversation, input.messageId);

    // Package from customer chat only (never Training Studio — it lists all plans).
    let pkg: SubscriptionPackage | null =
      detectSubscriptionPackage(input.messageText) ||
      detectSubscriptionPackage(inbound.text) ||
      detectSubscriptionPackage(inboundTextBlob);

    const emailOnlyTurn = hasCurrentEmail && !isImage;
    const imageOnlyTurn = isImage;
    const packageChoiceTurn = looksLikePackageChoice(input.messageText);
    const proofTurn =
      emailOnlyTurn ||
      imageOnlyTurn ||
      packageChoiceTurn ||
      looksLikeSubscriptionProofTurn(input.messageText) ||
      (Boolean(email) && Boolean(receipt?.mediaStorageKey));

    if (!proofTurn) return false;

    // Image without email → ask for registration email.
    if (isImage && !email) {
      this.logger.log(
        `[AI] Subscription proof: image without email — asking for email conversationId=${input.conversation.id}`,
      );
      const sent = await input.sendReply(buildSubscriptionAskEmailMessage());
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_ask_email');
      return true;
    }

    // Email without receipt → ask for transfer image.
    if (email && !receipt?.mediaStorageKey) {
      if (!hasCurrentEmail && !looksLikeSubscriptionProofTurn(input.messageText) && !isImage) {
        return false;
      }
      this.logger.log(
        `[AI] Subscription proof: email without receipt — asking for image conversationId=${input.conversation.id} email=${email}`,
      );
      const sent = await input.sendReply(buildSubscriptionAskReceiptMessage(email, pkg));
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_ask_receipt');
      return true;
    }

    if (!email || !receipt?.mediaStorageKey) return false;

    // Have email + receipt but no package yet → ask which package.
    if (!pkg) {
      this.logger.log(
        `[AI] Subscription proof: missing package — asking conversationId=${input.conversation.id}`,
      );
      const sent = await input.sendReply(buildSubscriptionAskPackageMessage(email));
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_ask_package');
      return true;
    }

    // Avoid duplicate orders for the same conversation + email within 24h.
    const existing = await this.findRecentSubscriptionOrder(
      input.teamId,
      input.conversation.id,
      email,
    );
    if (existing) {
      const sent = await input.sendReply(
        `تم استلام طلب اشتراكك مسبقًا ✅\nرقم الطلب: ${existing.orderNumber}\nالباقة: ${existing.orderType}\nإذا ما انفعل الاشتراك بعد، راسلنا وسنراجع طلبك.`,
      );
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_duplicate');
      return true;
    }

    const mastercard = extractMastercardFromTraining(input.studioTraining);

    let verdict: VisionReceiptVerdict;
    try {
      verdict = await this.verifyReceiptImage({
        teamId: input.teamId,
        storageKey: receipt.mediaStorageKey,
        mimeType: receipt.mediaMimeType ?? 'image/jpeg',
        fileName: receipt.mediaFileName ?? 'receipt.jpg',
        mastercard,
        expectedAmount: pkg.amountIqd,
      });
    } catch (error) {
      this.logger.warn(
        `[AI] Receipt vision failed conversationId=${input.conversation.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const sent = await input.sendReply(
        buildSubscriptionRejectReceiptMessage('تعذر قراءة الصورة حاليًا، أعد الإرسال بصورة أوضح.'),
      );
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_vision_error');
      return true;
    }

    const accepted =
      verdict.isTransferReceipt &&
      verdict.matchesCard &&
      verdict.confidence >= 0.45;

    if (!accepted) {
      const sent = await input.sendReply(
        buildSubscriptionRejectReceiptMessage(verdict.reason),
      );
      if (sent) await this.markAiReply(input.teamId, input.conversation.id, 'subscription_receipt_rejected');
      return true;
    }

    // If amount clearly matches another package, allow switching when customer chose wrong name.
    if (!amountMatchesPackage(verdict.amountSeen, pkg)) {
      const inferred = inferPackageFromAmount(verdict.amountSeen);
      if (inferred && inferred.key !== pkg.key) {
        this.logger.log(
          `[AI] Package amount mismatch; inferred=${inferred.key} chosen=${pkg.key} amount=${verdict.amountSeen}`,
        );
        const sent = await input.sendReply(
          buildSubscriptionAmountMismatchMessage(pkg, verdict.amountSeen),
        );
        if (sent) {
          await this.markAiReply(input.teamId, input.conversation.id, 'subscription_amount_mismatch', {
            chosen: pkg.key,
            inferred: inferred.key,
            amountSeen: verdict.amountSeen,
          });
        }
        return true;
      }
      const sent = await input.sendReply(
        buildSubscriptionAmountMismatchMessage(pkg, verdict.amountSeen),
      );
      if (sent) {
        await this.markAiReply(input.teamId, input.conversation.id, 'subscription_amount_mismatch', {
          chosen: pkg.key,
          amountSeen: verdict.amountSeen,
        });
      }
      return true;
    }

    await this.prisma.contact.update({
      where: { id: input.conversation.contactId },
      data: { email },
    }).catch(() => undefined);

    const planSlug = SubscriptionActivationService.planSlugFromPackageKey(pkg.key);
    const activated = await this.activation.activateByEmail(email, planSlug, {
      durationDays: 30,
      source: 'ai_subscription_proof',
    });

    if (!activated.ok) {
      const sent = await input.sendReply(buildSubscriptionUserNotFoundMessage(email));
      if (sent) {
        await this.markAiReply(input.teamId, input.conversation.id, 'subscription_user_not_found', {
          email,
          reason: activated.reason,
        });
      }
      // Still record the order for admin follow-up.
      await this.createSubscriptionBooking({
        teamId: input.teamId,
        conversation: input.conversation,
        email,
        pkg,
        mastercard,
        receipt,
        verdict,
        activated: false,
        amountMatched: true,
        resolveWhatsAppPhone: input.resolveWhatsAppPhone,
      });
      return true;
    }

    const booking = await this.createSubscriptionBooking({
      teamId: input.teamId,
      conversation: input.conversation,
      email,
      pkg,
      mastercard,
      receipt,
      verdict,
      activated: true,
      amountMatched: true,
      resolveWhatsAppPhone: input.resolveWhatsAppPhone,
      status: BookingStatus.CONFIRMED,
    });

    const thankYou = buildSubscriptionThankYouMessage(email, pkg, true);
    const withOrder = booking
      ? `${thankYou}\n\nرقم الطلب: ${booking.orderNumber}`
      : thankYou;
    const sent = await input.sendReply(withOrder);
    if (sent) {
      await this.markAiReply(input.teamId, input.conversation.id, 'subscription_activated', {
        orderNumber: booking?.orderNumber ?? null,
        email,
        package: pkg.label,
        planSlug,
        teamIdActivated: activated.teamId,
        receiptMessageId: receipt.id,
      });
    }
    this.logger.log(
      `[AI] Subscription activated conversationId=${input.conversation.id} email=${email} plan=${planSlug} order=${booking?.orderNumber ?? 'none'}`,
    );
    return true;
  }

  private async createSubscriptionBooking(input: {
    teamId: string;
    conversation: ProofConversation;
    email: string;
    pkg: SubscriptionPackage;
    mastercard: string;
    receipt: { id: string; mediaStorageKey: string | null };
    verdict: VisionReceiptVerdict;
    activated: boolean;
    amountMatched: boolean;
    resolveWhatsAppPhone: () => Promise<string | null | undefined>;
    status?: BookingStatus;
  }) {
    const notes = buildSubscriptionOrderNotes({
      email: input.email,
      packageLabel: input.pkg.label,
      mastercard: input.mastercard,
      receiptMessageId: input.receipt.id,
      mediaStorageKey: input.receipt.mediaStorageKey || '',
      visionSummary: `verified card=${input.verdict.cardNumberSeen || input.mastercard}; amount=${input.verdict.amountSeen || input.pkg.amountIqd}; conf=${input.verdict.confidence}`,
      activated: input.activated,
      amountMatched: input.amountMatched,
    });
    const whatsAppPhone = await input.resolveWhatsAppPhone();
    return this.bookings.createFromAi(
      input.teamId,
      input.conversation,
      {
        useWhatsAppPhone: true,
        address: `البريد: ${input.email}`,
        orderType: `اشتراك — ${input.pkg.label}`,
        totalAmount: input.pkg.amountIqd,
        currency: 'IQD',
        notes,
      },
      {
        whatsAppPhone,
        forceWhatsAppPhone: true,
        status: input.status ?? (input.activated ? BookingStatus.CONFIRMED : BookingStatus.PENDING),
      },
    );
  }

  private collectInboundText(conversation: ProofConversation, currentText: string): string {
    const parts = [currentText];
    for (const m of conversation.messages.slice(0, 40)) {
      if (m.direction !== MessageDirection.INBOUND) continue;
      if (m.text) parts.push(m.text);
    }
    return parts.join('\n');
  }

  private async loadInboundMessage(teamId: string, conversationId: string, messageId: string) {
    return this.prisma.conversationMessage.findFirst({
      where: { id: messageId, teamId, conversationId },
      select: {
        id: true,
        direction: true,
        type: true,
        text: true,
        mediaStorageKey: true,
        mediaMimeType: true,
        mediaFileName: true,
        createdAt: true,
      },
    });
  }

  private async waitForMediaKey(teamId: string, conversationId: string, messageId: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const row = await this.prisma.conversationMessage.findFirst({
        where: { id: messageId, teamId, conversationId },
        select: {
          mediaStorageKey: true,
          mediaMimeType: true,
          mediaFileName: true,
        },
      });
      if (row?.mediaStorageKey) return row;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  }

  private collectRecentText(conversation: ProofConversation, currentText: string): string {
    const parts = [currentText];
    for (const m of conversation.messages.slice(0, 25)) {
      if (m.text) parts.push(m.text);
    }
    return parts.join('\n');
  }

  private findRecentInboundEmail(conversation: ProofConversation): string | null {
    for (const m of conversation.messages.slice(0, 30)) {
      if (m.direction !== MessageDirection.INBOUND) continue;
      const found = extractEmails(m.text)[0];
      if (found) return found;
    }
    return null;
  }

  private findRecentInboundReceipt(
    conversation: ProofConversation,
    currentMessageId: string,
  ): ProofConversation['messages'][number] | null {
    const recent = conversation.messages
      .filter(
        (m) =>
          m.id !== currentMessageId &&
          m.direction === MessageDirection.INBOUND &&
          m.type === MessageType.IMAGE &&
          Boolean(m.mediaStorageKey),
      )
      .slice(0, 8);
    return recent[0] ?? null;
  }

  private async findRecentSubscriptionOrder(teamId: string, conversationId: string, email: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.booking.findMany({
      where: {
        teamId,
        conversationId,
        createdAt: { gte: since },
        OR: [
          { notes: { contains: email, mode: 'insensitive' } },
          { address: { contains: email, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  private guessAmountFromVerdict(verdict: VisionReceiptVerdict): number | null {
    const raw = String(verdict.amountSeen || '').replace(/[^\d]/g, '');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private async verifyReceiptImage(input: {
    teamId: string;
    storageKey: string;
    mimeType: string;
    fileName: string;
    mastercard: string;
    expectedAmount: number | null;
  }): Promise<VisionReceiptVerdict> {
    // Wait briefly if media file is still being written.
    let buffer: Buffer | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        buffer = await this.outbound.readMediaBuffer(input.storageKey);
        if (buffer?.length) break;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!buffer?.length) {
      throw new Error('Receipt media buffer missing');
    }

    const mime = (input.mimeType || 'image/jpeg').split(';')[0]!.trim() || 'image/jpeg';
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
    const amountHint = input.expectedAmount
      ? `Expected subscription amount around ${input.expectedAmount} IQD (or equivalent USD).`
      : 'Amount may be 15$, 25$, or 49$ (or IQD equivalents 22800 / 38000 / 74480).';

    const prompt = `You are verifying a Mastercard bank-transfer receipt for a SaaS subscription payment.

Required destination card number (must appear on the receipt, digits may have spaces): ${input.mastercard}
${amountHint}

Inspect the image carefully. Return ONLY valid JSON:
{"isTransferReceipt":true|false,"matchesCard":true|false,"cardNumberSeen":"digits or null","amountSeen":"string or null","confidence":0.0-1.0,"reason":"short Arabic or English note"}

Rules:
- isTransferReceipt=true only if this looks like a real bank/transfer/receipt screenshot (not a random photo).
- matchesCard=true only if the destination card/account clearly matches ${input.mastercard} (ignore spaces/dashes).
- If blurry or unreadable, set both false and explain in reason.`;

    const completion = await this.provider.chat(
      input.teamId,
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ],
      {
        temperature: 0,
        maxTokens: 400,
        json: true,
        persistUntilSuccess: true,
        correlationId: `sub-proof:${input.teamId}`,
      },
    );

    return parseVisionReceiptVerdict(completion.content);
  }

  private async markAiReply(
    teamId: string,
    conversationId: string,
    intent: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastAiReplyAt: new Date() },
    });
    await this.prisma.conversationEvent.create({
      data: {
        conversationId,
        type: ConversationEventType.AI_REPLY_SENT,
        metadata: { confidence: 1, intent, source: 'subscription_proof', ...metadata },
      },
    });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.AI_REPLY_SENT, { conversationId });
  }
}
