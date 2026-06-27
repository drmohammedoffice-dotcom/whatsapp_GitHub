import { AiTransferReason } from '@watsapp/database';

export type AiDecision = {
  reply: string;
  shouldTransfer: boolean;
  reason: AiTransferReason | null;
  confidence: number;
  intent?: string;
};

export function applyTransferRules(
  decision: AiDecision,
  settings: {
    confidenceThreshold: number;
    transferOnLowConfidence: boolean;
    transferOnComplaint: boolean;
    transferOnRefund: boolean;
    transferOnSensitive: boolean;
    transferOnHumanRequest: boolean;
  },
  messageText: string,
  noKnowledge: boolean,
  hasTrainingInstructions = false,
): AiDecision {
  const lower = messageText.toLowerCase();
  const humanPatterns = [/human/i, /agent/i, /representative/i, /موظف/i, /إنسان/i, /شخص/i];
  if (settings.transferOnHumanRequest && humanPatterns.some((p) => p.test(messageText))) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.CUSTOMER_REQUEST };
  }
  if (settings.transferOnComplaint && /complaint|angry|unacceptable|شكوى|غاضب/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.COMPLAINT };
  }
  if (!hasTrainingInstructions && (noKnowledge || decision.reason === AiTransferReason.KNOWLEDGE_GAP)) {
    return {
      ...decision,
      shouldTransfer: true,
      reason: AiTransferReason.KNOWLEDGE_GAP,
      reply: decision.reply || 'I do not have that information in our knowledge base. Let me connect you with a human agent who can help.',
    };
  }
  if (settings.transferOnRefund && /refund|return money|استرداد|إرجاع/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.REFUND_REQUEST };
  }
  if (settings.transferOnSensitive && /lawyer|legal|suicide|medical emergency|محامي|طوارئ/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.SENSITIVE_ISSUE };
  }
  if (settings.transferOnLowConfidence && decision.confidence < settings.confidenceThreshold) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.LOW_CONFIDENCE };
  }
  return decision;
}

export function parseAiDecision(raw: string): AiDecision {
  try {
    const parsed = JSON.parse(raw) as Partial<AiDecision>;
    return {
      reply: String(parsed.reply ?? 'Thank you for your message. How can I help you?'),
      shouldTransfer: Boolean(parsed.shouldTransfer),
      reason: (parsed.reason as AiTransferReason) ?? null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      intent: parsed.intent,
    };
  } catch {
    return { reply: raw.trim(), shouldTransfer: false, reason: null, confidence: 0.4 };
  }
}
