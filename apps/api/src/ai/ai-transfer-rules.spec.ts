import { AiTransferReason } from '@watsapp/database';
import {
  applyTransferRules,
  detectScriptedReplyIntent,
  extractOrderedMessageScript,
  normalizeReplyMessages,
  parseAiDecision,
  resolveScriptedRepliesForQuestion,
} from './ai-transfer-rules';

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
    );
    expect(decision.shouldTransfer).toBe(true);
    expect(decision.reason).toBe(AiTransferReason.CUSTOMER_REQUEST);
  });

  it('does not auto-transfer on empty knowledge search', () => {
    const decision = applyTransferRules(
      { reply: 'How can I help you?', shouldTransfer: false, reason: null, confidence: 0.9 },
      baseSettings,
      'What is your warranty coverage for premium plans in Norway?',
    );
    expect(decision.shouldTransfer).toBe(false);
  });

  it('transfers when model explicitly requests knowledge gap handover', () => {
    const decision = applyTransferRules(
      { reply: 'Connecting you to an agent.', shouldTransfer: true, reason: AiTransferReason.KNOWLEDGE_GAP, confidence: 0.9 },
      baseSettings,
      'What is your warranty coverage?',
    );
    expect(decision.shouldTransfer).toBe(true);
    expect(decision.reason).toBe(AiTransferReason.KNOWLEDGE_GAP);
  });

  it('parses structured AI JSON', () => {
    const parsed = parseAiDecision('{"reply":"Hello","shouldTransfer":false,"reason":null,"confidence":0.8}');
    expect(parsed.reply).toBe('Hello');
    expect(parsed.confidence).toBe(0.8);
  });

  it('parses multi-bubble replies array', () => {
    const parsed = parseAiDecision(
      '{"reply":"مرحبا","replies":["مرحبا","تفاصيل المنتج","السعر 25000"],"shouldTransfer":false,"reason":null,"confidence":0.9}',
    );
    expect(parsed.replies).toEqual(['مرحبا', 'تفاصيل المنتج', 'السعر 25000']);
    expect(parsed.reply).toBe('مرحبا');
  });

  it('extracts reply from truncated JSON instead of sending raw JSON', () => {
    const truncated =
      '{"reply":"🌹 طبعًا، إليك تفاصيل أكثر عن Chatloora:\\n\\nChatloora هي منصة ذكية","shouldTransfer":false,"createBooking":';
    const parsed = parseAiDecision(truncated);
    expect(parsed.reply).toContain('Chatloora');
    expect(parsed.reply.startsWith('{')).toBe(false);
    expect(parsed.reply).not.toContain('shouldTransfer');
  });

  it('normalizes separator-based multi bubbles from a single reply', () => {
    const msgs = normalizeReplyMessages({
      reply: 'مرحبا\n---\nتفاصيل المنتج\n---\nالسعر 25000',
    });
    expect(msgs).toEqual(['مرحبا', 'تفاصيل المنتج', 'السعر 25000']);
  });

  it('extracts ordered Training Studio message scripts', () => {
    const training = `
قواعد
الرسالة الأولى:
أهلاً وسهلاً نورتونا 🌺
هاي الأداة اسمها Chatloora
تحسين نتائج الحملات الإعلانية

الرسالة الثانية:
موقع المنصة
www.chatloora.com
الباقات
🟢 الأساسية 15$

الرسالة الثالثة:
طريقة الاشتراك
الماستركارد 2606424980

الرسالة الرابعة:
https://youtu.be/Kxtc-8vPFNk
إذا احتجت مساعدة راسلنا

## قواعد إضافية
الرسالة الأولى:
ترسل جميع معلومات المنصة كاملة داخل رسالة واحدة فقط
ممنوع تقسيم هذه الرسالة
`;
    const script = extractOrderedMessageScript(training);
    expect(script).toHaveLength(4);
    expect(script[0]).toContain('أهلاً وسهلاً');
    expect(script[0]).toContain('Chatloora');
    expect(script[1]).toContain('www.chatloora.com');
    expect(script[2]).toContain('2606424980');
    expect(script[3]).toContain('youtu.be');
    expect(script[0]).not.toContain('ممنوع تقسيم');
  });

  it('bundles platform info sections into three WhatsApp bubbles', () => {
    const training = `
معلومات المنصة

أهلاً وسهلاً نورتونا 🌺
تحسين نتائج الحملات الإعلانية.

⸻

موقع المنصة
www.chatloora.com
ادخل على الموقع وسجل حساب جديد.

⸻

الباقات
🟢 الأساسية 15$ شهريًا
🔵 الاحترافية 25$ شهريًا
🟣 الأعمال 49$ شهريًا

⸻

طريقة الاشتراك
حوّل على الماستركارد 2606424980 باسم محمد أحمد

⸻

وكالة تيك توك
نوفرلك وكالة مجانية.

⸻

الفيديو التعليمي
https://youtu.be/Kxtc-8vPFNk?si=test
`;
    const script = extractOrderedMessageScript(training);
    expect(script).toHaveLength(3);
    expect(script[0]).toContain('أهلاً وسهلاً');
    expect(script[1]).toContain('www.chatloora.com');
    expect(script[1]).toContain('الباقات');
    expect(script[2]).toContain('2606424980');
    expect(script[2]).toContain('youtu.be');
  });

  it('routes scripted replies by customer intent (full vs specific)', () => {
    const training = `
قواعد إلزامية
إذا سأل شنو الباقات؟ ترسل الرسالة الثانية فقط.
إذا سأل الفيديو التعليمي؟ ترسل جزء الفيديو فقط.

=========================
الرسالة الأولى
=========================

أهلاً وسهلاً نورتونا 🌺
هاي الأداة اسمها Chatloora.
تحسين نتائج الحملات الإعلانية.

=========================
الرسالة الثانية
=========================

موقع المنصة
www.chatloora.com
الباقات
🟢 الأساسية
15$ شهريًا = 22,000 دينار عراقي

=========================
الرسالة الثالثة
=========================

طريقة الاشتراك
حوّل مبلغ الاشتراك على الماستركارد:
2606424980
باسم: محمد أحمد

الفيديو التعليمي
https://youtu.be/Kxtc-8vPFNk?si=6st-6SorBOeaIQZy
`;

    expect(detectScriptedReplyIntent('أريد التفاصيل')).toBe('full');
    expect(detectScriptedReplyIntent('اشرحلي المنصة')).toBe('full');
    expect(detectScriptedReplyIntent('شنو الباقات؟')).toBe('packages');
    expect(detectScriptedReplyIntent('الباقات المتوفرة؟')).toBe('packages');
    expect(detectScriptedReplyIntent('أريد الباقة الثانية')).toBe('choose_package');
    expect(detectScriptedReplyIntent('أبي الباقة الاحترافية')).toBe('choose_package');
    expect(detectScriptedReplyIntent('شلون أشترك؟')).toBe('subscribe');
    expect(detectScriptedReplyIntent('الفيديو التعليمي؟')).toBe('video');
    expect(detectScriptedReplyIntent('مرحبا')).toBe(null);

    const full = resolveScriptedRepliesForQuestion(training, 'احچيلي عن المنصة');
    expect(full).toHaveLength(3);
    expect(full[0]).toContain('Chatloora');
    expect(full[1]).toContain('الباقات');
    expect(full[2]).toContain('2606424980');

    const packs = resolveScriptedRepliesForQuestion(training, 'شنو الباقات؟');
    expect(packs).toHaveLength(1);
    expect(packs[0]).toContain('www.chatloora.com');
    expect(packs[0]).toContain('15$');
    expect(packs[0]).not.toContain('Chatloora');
    expect(packs[0]).not.toContain('2606424980');

    const chosen = resolveScriptedRepliesForQuestion(training, 'أريد الباقة الثانية');
    expect(chosen.length).toBeGreaterThanOrEqual(1);
    expect(chosen.join('\n')).toContain('الاحترافية');
    expect(chosen.join('\n')).toContain('25$');
    expect(chosen.join('\n')).toContain('2606424980');
    expect(chosen.join('\n')).toContain('www.chatloora.com');
    expect(chosen.join('\n')).not.toContain('الأساسية');
    expect(chosen.join('\n')).not.toContain('الأعمال');
    expect(chosen.join('\n')).not.toContain('15$');

    const sub = resolveScriptedRepliesForQuestion(training, 'طريقة الاشتراك؟');
    expect(sub).toHaveLength(1);
    expect(sub[0]).toContain('2606424980');
    expect(sub[0]).not.toContain('الباقات');

    const video = resolveScriptedRepliesForQuestion(training, 'الفيديو التعليمي؟');
    expect(video).toHaveLength(1);
    expect(video[0]).toContain('youtu.be/Kxtc-8vPFNk');
    expect(video[0]).not.toContain('2606424980');
    expect(video[0]).not.toContain('الباقات');
  });
});
