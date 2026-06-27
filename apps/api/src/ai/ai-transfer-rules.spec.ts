import { AiTransferReason } from '@watsapp/database';
import { applyTransferRules, parseAiDecision } from './ai-transfer-rules';

describe('ai-transfer-rules', () => {
  const baseSettings = {
    confidenceThreshold: 0.65,
    transferOnLowConfidence: true,
    transferOnComplaint: true,
    transferOnRefund: true,
    transferOnSensitive: true,
    transferOnHumanRequest: true,
  };

  it('transfers when customer requests human', () => {
    const decision = applyTransferRules(
      { reply: 'ok', shouldTransfer: false, reason: null, confidence: 0.9 },
      baseSettings,
      'I want to speak to a human agent',
      false,
    );
    expect(decision.shouldTransfer).toBe(true);
    expect(decision.reason).toBe(AiTransferReason.CUSTOMER_REQUEST);
  });

  it('transfers on knowledge gap', () => {
    const decision = applyTransferRules(
      { reply: '', shouldTransfer: false, reason: null, confidence: 0.9 },
      baseSettings,
      'What is your warranty coverage for premium plans in Norway?',
      true,
    );
    expect(decision.shouldTransfer).toBe(true);
    expect(decision.reason).toBe(AiTransferReason.KNOWLEDGE_GAP);
  });

  it('parses structured AI JSON', () => {
    const parsed = parseAiDecision('{"reply":"Hello","shouldTransfer":false,"reason":null,"confidence":0.8}');
    expect(parsed.reply).toBe('Hello');
    expect(parsed.confidence).toBe(0.8);
  });
});
