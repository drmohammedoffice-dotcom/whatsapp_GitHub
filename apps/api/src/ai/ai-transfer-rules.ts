import { AiTransferReason } from '@watsapp/database';
import {
  detectSubscriptionPackage,
  type SubscriptionPackage,
} from './ai-subscription-proof';

export type AiDecision = {
  /** Primary customer-facing text (back-compat). Prefer `replies` for multi-bubble. */
  reply: string;
  /**
   * Sequential WhatsApp bubbles in one turn.
   * When set (non-empty), each item is sent as a separate message.
   */
  replies?: string[];
  shouldTransfer: boolean;
  reason: AiTransferReason | null;
  confidence: number;
  intent?: string;
};

/** Max WhatsApp text bubbles per AI turn. */
export const MAX_AI_REPLY_MESSAGES = 8;

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
): AiDecision {
  const lower = messageText.toLowerCase();
  const humanPatterns = [/human/i, /agent/i, /representative/i, /موظف/i, /إنسان/i, /شخص/i];
  if (settings.transferOnHumanRequest && humanPatterns.some((p) => p.test(messageText))) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.CUSTOMER_REQUEST };
  }
  if (settings.transferOnComplaint && /complaint|angry|unacceptable|شكوى|غاضب/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.COMPLAINT };
  }
  // Only transfer on knowledge gap when the model explicitly requests it — not
  // merely because the vector search returned no chunks. The system prompt
  // already instructs the model to reply helpfully when context is missing.
  if (decision.shouldTransfer && decision.reason === AiTransferReason.KNOWLEDGE_GAP) {
    return decision;
  }
  if (settings.transferOnRefund && /refund|return money|استرداد|إرجاع/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.REFUND_REQUEST };
  }
  if (settings.transferOnSensitive && /lawyer|legal|suicide|medical emergency|محامي|طوارئ/i.test(lower)) {
    return { ...decision, shouldTransfer: true, reason: AiTransferReason.SENSITIVE_ISSUE };
  }
  if (
    settings.transferOnLowConfidence &&
    decision.shouldTransfer &&
    decision.confidence < settings.confidenceThreshold
  ) {
    return { ...decision, shouldTransfer: true, reason: decision.reason ?? AiTransferReason.LOW_CONFIDENCE };
  }
  return decision;
}

/**
 * Models sometimes wrap JSON in markdown fences (```json ... ```), add prose
 * around it, or return plain text. Extract the JSON object before parsing so we
 * don't lose the reply and accidentally send an empty message.
 */
export function extractJsonObject(raw: string): string | null {
  const withoutFences = raw.replace(/```(?:json)?/gi, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
}

/**
 * Pull the "reply" string even from truncated / invalid JSON (common when
 * max_tokens cuts the completion mid-object). Never return the raw JSON blob.
 */
export function extractReplyField(raw: string): string | null {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  // Match "reply": "....." with escapes; allow unclosed string at end (truncation).
  const m = /"reply"\s*:\s*"((?:\\.|[^"\\])*)"?/s.exec(text);
  if (!m?.[1]) return null;
  try {
    // JSON.parse on a quoted string unescapes \n \" etc.
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();
  }
}

/** Pull `"replies": ["a","b"]` even from partially truncated JSON. */
export function extractRepliesField(raw: string): string[] | null {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  const start = /"replies"\s*:\s*\[/.exec(text);
  if (!start) return null;
  const from = start.index + start[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = end >= 0 ? text.slice(from, end + 1) : `${text.slice(from)}]`;
  try {
    const arr = JSON.parse(slice) as unknown;
    if (!Array.isArray(arr)) return null;
    const items = arr.map((x) => String(x ?? '').trim()).filter(Boolean);
    return items.length ? items : null;
  } catch {
    // Truncated array of strings — salvage complete quoted items.
    const items: string[] = [];
    const re = /"((?:\\.|[^"\\])*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(slice))) {
      try {
        items.push(JSON.parse(`"${m[1]}"`) as string);
      } catch {
        items.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim());
      }
    }
    return items.length ? items : null;
  }
}

/**
 * Split a single reply into bubbles when training/model used explicit separators.
 * Separators: --- on its own line, [رسالة N], or ||MSG||
 */
export function splitReplyBubbles(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/\n\s*---+\s*\n/.test(trimmed) || /\|\|MSG\|\|/.test(trimmed) || /\n\s*\[رسالة\s*\d+\]\s*\n/i.test(trimmed)) {
    const parts = trimmed
      .split(/\n\s*---+\s*\n|\|\|MSG\|\||\n\s*\[رسالة\s*\d+\]\s*\n/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts.slice(0, MAX_AI_REPLY_MESSAGES);
  }
  return [trimmed];
}

const MESSAGE_ORDINAL_INDEX: Record<string, number> = {
  الأولى: 1,
  الاولى: 1,
  الأول: 1,
  الاول: 1,
  '1': 1,
  الثانية: 2,
  '2': 2,
  الثالثة: 3,
  '3': 3,
  الرابعة: 4,
  '4': 4,
  الخامسة: 5,
  '5': 5,
  السادسة: 6,
  '6': 6,
  السابعة: 7,
  '7': 7,
  الثامنة: 8,
  '8': 8,
};

/** True when the bubble is meta-instructions, not customer-facing copy. */
function isInstructionOnlyBubble(body: string): boolean {
  const text = body.trim();
  if (text.length < 30) return true;
  const hasCustomerCopy =
    /أهلاً|اهلا|نورتونا|www\.|http|youtu|الباقات|الأساسية|الاحترافية|الماستركارد|\d{8,}|اشتراكك|واتساب/i.test(
      text,
    );
  const looksInstruction =
    /ترسل داخل رسالة|بعد الانتهاء من الرسالة|ممنوع (تقسيم|إرسال)|يجب إرسال الرد على شكل|لا يجوز إرسال أكثر|انتظ[ر]? حتى يتم إرسالها|يمنع منعًا باتًا|هذه التعليمات تعتبر أوامر/i.test(
      text,
    );
  return looksInstruction && !hasCustomerCopy;
}

function cleanScriptBubble(body: string): string {
  return body
    .replace(/^\s*=+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract ordered WhatsApp scripts from Training Studio text that uses
 * "الرسالة الأولى" / "الرسالة الثانية" headers (with or without ==== separators).
 * Prefers customer-facing copy when the same ordinal appears twice (content vs rules).
 */
export function extractOrderedMessageScript(training: string | null | undefined): string[] {
  const text = String(training || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) return [];

  const fromHeaders = extractScriptFromMessageHeaders(text);
  if (fromHeaders.length >= 2) {
    const hasLink = fromHeaders.some((b) => /https?:\/\/|www\./i.test(b));
    if (fromHeaders.length >= 3 && hasLink) return fromHeaders;
    const bundled = extractScriptFromContentSections(text);
    if (bundled.length >= 3) return bundled;
    return fromHeaders;
  }

  return extractScriptFromContentSections(text);
}

function extractScriptFromMessageHeaders(text: string): string[] {
  // Supports:
  // الرسالة الأولى:
  // =========================\nالرسالة الأولى\n=========================
  const headerRe =
    /(?:^|\n)\s*(?:=+\s*\n)?\s*الرسالة\s+(الأولى|الاولى|الأول|الاول|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|\d+)\s*[:：]?\s*(?:\n\s*=+\s*)?/gi;
  const matches: Array<{ index: number; ord: number; headerLen: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text))) {
    const raw = String(m[1] || '').trim();
    const ord = MESSAGE_ORDINAL_INDEX[raw] ?? Number(raw);
    if (!Number.isFinite(ord) || ord < 1 || ord > MAX_AI_REPLY_MESSAGES) continue;
    const full = m[0];
    const leadingNl = full.startsWith('\n') ? 1 : 0;
    matches.push({
      index: m.index + leadingNl,
      ord,
      headerLen: full.length - leadingNl,
    });
  }
  if (matches.length < 2) return [];

  const byOrd = new Map<number, string>();
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const start = cur.index + cur.headerLen;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    let body = cleanScriptBubble(text.slice(start, end));
    body = body.replace(/\n#{1,3}\s.*$/s, '').trim();
    if (!body || isInstructionOnlyBubble(body)) continue;
    const prev = byOrd.get(cur.ord);
    if (!prev || body.length > prev.length) byOrd.set(cur.ord, body);
  }

  const ords = [...byOrd.keys()].sort((a, b) => a - b);
  if (ords.length < 2 || ords[0] !== 1) return [];
  const out: string[] = [];
  for (let i = 1; i <= ords[ords.length - 1]!; i++) {
    const part = byOrd.get(i);
    if (!part) break;
    out.push(part);
  }
  return out.length >= 2 ? out.slice(0, MAX_AI_REPLY_MESSAGES) : [];
}

/** Bundle classic sales-script sections into WhatsApp bubbles (intro / site+packs / subscribe+video). */
function extractScriptFromContentSections(text: string): string[] {
  const sliceBetween = (startRe: RegExp, endRe: RegExp | null): string => {
    const start = startRe.exec(text);
    if (!start) return '';
    const from = start.index;
    let to = text.length;
    if (endRe) {
      endRe.lastIndex = 0;
      const rest = text.slice(from + start[0].length);
      const end = endRe.exec(rest);
      if (end) to = from + start[0].length + end.index;
    }
    return cleanScriptBubble(text.slice(from, to));
  };

  const intro = sliceBetween(
    /أهلاً\s*وسهلاً|اهلا\s*وسهلا/i,
    /\n\s*(?:⸻|---+|=+)\s*\n|\n\s*موقع\s+المنصة|\n\s*الباقات/i,
  );
  const site = sliceBetween(
    /\nموقع\s+المنصة|\nwww\./i,
    /\n\s*(?:⸻|---+|=+)\s*\n|\n\s*الباقات|\n\s*طريقة\s+الاشتراك/i,
  );
  const packs = sliceBetween(
    /\nالباقات/i,
    /\n\s*(?:⸻|---+|=+)\s*\n|\n\s*طريقة\s+الاشتراك|\n\s*وكالة/i,
  );
  const subscribe = sliceBetween(
    /\nطريقة\s+الاشتراك/i,
    /\n\s*(?:⸻|---+|=+)\s*\n|\n\s*وكالة\s+تيك|\n\s*الفيديو\s+التعليمي/i,
  );
  const agency = sliceBetween(
    /\nوكالة\s+تيك\s*توك/i,
    /\n\s*(?:⸻|---+|=+)\s*\n|\n\s*الفيديو\s+التعليمي/i,
  );
  const video = sliceBetween(/\nالفيديو\s+التعليمي|\nhttps?:\/\/(?:www\.)?youtu/i, /\n#{1,3}\s|$/i);

  const msg1 = intro.trim();
  const msg2 = [site, packs].map((s) => s.trim()).filter(Boolean).join('\n\n').trim();
  const msg3 = [subscribe, agency, video].map((s) => s.trim()).filter(Boolean).join('\n\n').trim();

  const out = [msg1, msg2, msg3].filter((s) => s.length >= 40);
  return out.length >= 2 ? out.slice(0, MAX_AI_REPLY_MESSAGES) : [];
}

export type ScriptedReplyIntent =
  | 'full'
  | 'intro'
  | 'packages'
  | 'choose_package'
  | 'website'
  | 'subscribe'
  | 'video'
  | null;

/** Customer asked to list all packages (not picking one). */
export function isGeneralPackagesListRequest(message: string): boolean {
  const m = String(message || '').trim();
  if (!m) return false;
  return /شنو\s*(ال)?باقات|الباقات\s*(المتوفرة|موجودة|وش|شنهي)|عرض\s*(ال)?باقات|أسعار(\s*ال)?باقات|اسعار(\s*ال)?باقات|كل\s*(ال)?باقات|جميع\s*(ال)?باقات|ما\s*هي\s*(ال)?باقات|الباقات\s*\?|^الباقات\s*$/i.test(
    m,
  );
}

/** Customer selected one specific package to subscribe to. */
export function isPackageSelectionRequest(message: string): boolean {
  const m = String(message || '').trim();
  if (!m || isGeneralPackagesListRequest(m)) return false;
  const pkg = detectSubscriptionPackage(m);
  if (!pkg) return false;
  // Explicit selection / subscribe language, or naming a package ordinal/name as the ask.
  if (
    /أريد|ابي|أبي|اريد|اشترك|أشتراك|اشتراك|اختار|أختار|نختار|خذ|اخذ|أبيها|اريدها|بالباقة|باق[ةه]\s*(الأولى|الاولى|الثانية|الثالثة|الأساسية|الاساسية|الاحترافية|الأعمال)/i.test(
      m,
    )
  ) {
    return true;
  }
  // Short replies like "الاحترافية" / "الثانية" after being asked which package.
  if (m.length <= 40 && detectSubscriptionPackage(m)) return true;
  return false;
}

/**
 * Detect whether the customer asked for the full script or a specific section.
 * Specific intents are checked before the general "full details" intent.
 */
export function detectScriptedReplyIntent(message: string): ScriptedReplyIntent {
  const m = String(message || '').trim();
  if (!m) return null;

  if (/فيديو|يوتيوب|youtu\.?be|تعليمي/i.test(m)) return 'video';

  // Choosing one package (الباقة الثانية / الأساسية…) — before list-all or generic subscribe.
  if (isPackageSelectionRequest(m)) return 'choose_package';

  if (
    /اشترك|أشتراك|اشتراك|شلون\s*أ?شترك|طريقة\s*الاشتراك|ماستركارد|حو[ّ']?ل\s*مبلغ|رقم\s*البطاقة|الدفع|ادفع/i.test(
      m,
    )
  ) {
    return 'subscribe';
  }
  if (isGeneralPackagesListRequest(m)) return 'packages';
  if (
    /باقات|سعر|اسعار|أسعار|كم\s*(السعر|سعر)|التسعير|22,?000|35,?000|68,?000/i.test(m) &&
    !detectSubscriptionPackage(m)
  ) {
    return 'packages';
  }
  if (/موقع(\s*المنصة)?|رابط\s*الموقع|www\.|chatloora|almutamayiziq|سجل(ي|وا)?\s*حساب/i.test(m)) {
    return 'website';
  }
  if (
    /تفاصيل|احچي|احكي|احچولي|احكولي|اشرح|شرح\s*المنصة|أريد\s*أعرف\s*أكثر|ابي\s*اعرف|أبي\s*أعرف|اريد\s*اعرف|أريد أعرف أكثر|شلون\s*تشتغل|عرفني|معلومات\s*(عن|أكثر|اكثر)|أكثر\s*عن|اكثر\s*عن|اشرحلي|اشرحيلي/i.test(
      m,
    )
  ) {
    return 'full';
  }
  if (/شنو\s*(هاي|هذي|هذا)|ما\s*هي|ماهيه|chatloora|شاتلورا|المنصة\s*(شنو|ما)/i.test(m)) {
    return 'intro';
  }
  return null;
}

/** Extract one package block (features + price) from الرسالة الثانية text. */
export function extractSinglePackageBlock(
  packagesBubble: string,
  pkg: SubscriptionPackage,
): string {
  const text = String(packagesBubble || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return '';

  const starts: Array<{ key: SubscriptionPackage['key']; index: number; header: string }> = [];
  const patterns: Array<{ key: SubscriptionPackage['key']; re: RegExp }> = [
    { key: 'basic', re: /🟢\s*الأساسية|🟢\s*الاساسية|(?:^|\n)\s*الأساسية\s*$|(?:^|\n)\s*الاساسية\s*$/gim },
    { key: 'pro', re: /🔵\s*الاحترافية|(?:^|\n)\s*الاحترافية\s*$/gim },
    { key: 'business', re: /🟣\s*الأعمال|🟣\s*الاعمال|(?:^|\n)\s*الأعمال\s*$|(?:^|\n)\s*الاعمال\s*$/gim },
  ];
  for (const { key, re } of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) starts.push({ key, index: m.index, header: m[0].replace(/^\n/, '') });
  }
  starts.sort((a, b) => a.index - b.index);
  const mine = starts.find((s) => s.key === pkg.key);
  if (!mine) {
    // Fallback: slice by label name
    const labelRe = new RegExp(`${pkg.label}[\\s\\S]*?(?=🟢|🔵|🟣|طريقة\\s+الاشتراك|$)`, 'i');
    const hit = labelRe.exec(text);
    return hit?.[0]?.trim() || '';
  }
  const next = starts.find((s) => s.index > mine.index);
  const end = next ? next.index : text.length;
  return cleanScriptBubble(text.slice(mine.index, end));
}

/** Website / register lines from الرسالة الثانية (without the packages list). */
export function extractWebsiteSection(packagesBubble: string): string {
  const text = String(packagesBubble || '').replace(/\r\n/g, '\n');
  const start = /موقع\s+المنصة|www\.chatloora\.com|www\.almutamayiziq\.com/i.exec(text);
  if (!start) {
    if (/www\.chatloora\.com|www\.almutamayiziq\.com/i.test(text)) {
      return 'موقع المنصة\n\nwww.chatloora.com';
    }
    return '';
  }
  const from = start.index;
  const endMatch = /\n\s*الباقات\s*\n|\n\s*🟢|\n\s*🔵|\n\s*🟣/i.exec(text.slice(from + 1));
  const end = endMatch ? from + 1 + endMatch.index : text.length;
  return cleanScriptBubble(text.slice(from, end));
}

/** Mastercard / subscribe steps from الرسالة الثالثة without the video section. */
export function extractSubscribeStepsSection(subscribeBubble: string): string {
  const text = String(subscribeBubble || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  const withoutVideo = text.replace(/\n\s*الفيديو\s*التعليمي[\s\S]*$/i, '').trim();
  return cleanScriptBubble(withoutVideo || text);
}

/**
 * Build the rule-14 reply: only the chosen package + site + payment steps (verbatim from training).
 */
export function buildChosenPackageSubscribeReplies(
  training: string | null | undefined,
  message: string,
): string[] {
  const pkg = detectSubscriptionPackage(message);
  if (!pkg) return [];
  const script = extractOrderedMessageScript(training);
  const packagesBubble = script[1] || '';
  const subscribeBubble = script[2] || script[script.length - 1] || '';

  const packageBlock = extractSinglePackageBlock(packagesBubble, pkg);
  const website = extractWebsiteSection(packagesBubble);
  const steps = extractSubscribeStepsSection(subscribeBubble);
  const mastercard =
    /2606424980/.exec(String(training || ''))?.[0] ||
    /2606424980/.exec(subscribeBubble)?.[0] ||
    '2606424980';

  const ordinalLabel =
    pkg.ordinal === 1 ? 'الأولى' : pkg.ordinal === 2 ? 'الثانية' : 'الثالثة';

  const parts: string[] = [];
  parts.push(
    [
      `تمام، سيتم الاشتراك بالباقة ${ordinalLabel} (${pkg.label}).`,
      '',
      packageBlock ||
        `${pkg.label}\n${pkg.amountUsd}$ شهريًا = ${pkg.amountIqd.toLocaleString('en-US')} دينار عراقي`,
    ].join('\n'),
  );

  const howto = [
    website || 'موقع المنصة\n\nwww.chatloora.com\n\nادخل على الموقع وسجل حساب جديد، وبعدها أرسل إلنا الإيميل اللي سجلت بيه حتى نفعّل اشتراكك.',
    '',
    steps ||
      [
        'طريقة الاشتراك',
        '',
        'حوّل مبلغ الاشتراك على الماستركارد:',
        mastercard,
        'باسم: محمد أحمد',
        '',
        'أرسل إلنا وصل التحويل مع الإيميل اللي سجلت بيه بالمنصة، ونفعّل اشتراكك مباشرة.',
      ].join('\n'),
  ]
    .join('\n')
    .trim();

  // Keep as two WhatsApp bubbles: (1) chosen package (2) site + payment — never dump all packages.
  parts.push(howto);
  return parts.map((p) => cleanScriptBubble(p)).filter(Boolean);
}

/** Pull only the educational-video section from a scripted bubble. */
export function extractVideoSection(bubble: string): string {
  const text = String(bubble || '').trim();
  if (!text) return '';
  const block = /الفيديو\s*التعليمي[\s\S]*/i.exec(text);
  if (block?.[0]?.trim()) return cleanScriptBubble(block[0]);
  const url = /https?:\/\/(?:www\.)?youtu[^\s]+/i.exec(text);
  if (url?.[0]) return `الفيديو التعليمي\n\n${url[0]}`;
  return '';
}

/**
 * Resolve which Training Studio bubbles to send for this customer question.
 * - full details → all bubbles in order
 * - packages/prices/website → message 2 only
 * - choose_package → only chosen package + subscribe steps (rule 14)
 * - subscription → message 3 only
 * - video → video section only (from message 3 when bundled)
 */
export function resolveScriptedRepliesForQuestion(
  training: string | null | undefined,
  message: string,
): string[] {
  const intent = detectScriptedReplyIntent(message);
  if (!intent) return [];
  const script = extractOrderedMessageScript(training);
  if (script.length < 2 && intent !== 'choose_package') return [];

  switch (intent) {
    case 'full':
      return script;
    case 'intro':
      return script[0] ? [script[0]] : [];
    case 'packages':
    case 'website':
      return script[1] ? [script[1]] : [];
    case 'choose_package':
      return buildChosenPackageSubscribeReplies(training, message);
    case 'subscribe':
      return script[2] ? [script[2]] : script.slice(-1);
    case 'video': {
      const fromThird = extractVideoSection(script[2] || '');
      if (fromThird) return [fromThird];
      for (let i = script.length - 1; i >= 0; i--) {
        const part = extractVideoSection(script[i]!);
        if (part) return [part];
      }
      return [];
    }
    default:
      return [];
  }
}

/** @deprecated use detectScriptedReplyIntent / resolveScriptedRepliesForQuestion */
export function isScriptedDetailRequest(message: string): boolean {
  return detectScriptedReplyIntent(message) != null;
}

/** Normalize decision.reply / decision.replies into ordered WhatsApp bubbles. */
export function normalizeReplyMessages(decision: {
  reply?: string | null;
  replies?: unknown;
}): string[] {
  const fromArray = Array.isArray(decision.replies)
    ? decision.replies.map((r) => String(r ?? '').trim()).filter(Boolean)
    : [];
  if (fromArray.length) return fromArray.slice(0, MAX_AI_REPLY_MESSAGES);

  const partialRaw =
    typeof decision.replies === 'string' ? extractRepliesField(String(decision.replies)) : null;
  if (partialRaw?.length) return partialRaw.slice(0, MAX_AI_REPLY_MESSAGES);

  const single = String(decision.reply ?? '').trim();
  if (!single) return [];
  return splitReplyBubbles(single).slice(0, MAX_AI_REPLY_MESSAGES);
}

function looksLikeOrchestratorJson(raw: string): boolean {
  const t = raw.trim();
  return (
    t.startsWith('{') &&
    (/\"reply\"\s*:/.test(t) ||
      /\"replies\"\s*:/.test(t) ||
      /\"shouldTransfer\"\s*:/.test(t) ||
      /\"sendMediaIds\"\s*:/.test(t) ||
      /\"createBooking\"\s*:/.test(t))
  );
}

export function parseAiDecision(raw: string): AiDecision {
  const json = extractJsonObject(raw);
  if (json) {
    try {
      const parsed = JSON.parse(json) as Partial<AiDecision> & { replies?: unknown };
      const replies = Array.isArray(parsed.replies)
        ? parsed.replies.map((r) => String(r ?? '').trim()).filter(Boolean)
        : extractRepliesField(raw) ?? undefined;
      const reply =
        typeof parsed.reply === 'string'
          ? parsed.reply.trim()
          : replies?.[0]?.trim() || '';
      if (reply || (replies && replies.length)) {
        return {
          reply: reply || (replies?.[0] ?? ''),
          replies: replies?.length ? replies.slice(0, MAX_AI_REPLY_MESSAGES) : undefined,
          shouldTransfer: Boolean(parsed.shouldTransfer),
          reason: (parsed.reason as AiTransferReason) ?? null,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          intent: parsed.intent,
        };
      }
    } catch {
      /* fall through — try partial reply extraction */
    }
  }

  const partialReplies = extractRepliesField(raw);
  if (partialReplies?.length) {
    return {
      reply: partialReplies[0]!,
      replies: partialReplies.slice(0, MAX_AI_REPLY_MESSAGES),
      shouldTransfer: false,
      reason: null,
      confidence: 0.6,
    };
  }

  const partial = extractReplyField(raw);
  if (partial?.trim()) {
    return {
      reply: partial.trim(),
      shouldTransfer: false,
      reason: null,
      confidence: 0.6,
    };
  }

  // Not JSON — treat as plain text, but never send an orchestrator JSON skeleton to the customer.
  const plain = raw.trim();
  if (looksLikeOrchestratorJson(plain)) {
    return { reply: '', shouldTransfer: false, reason: null, confidence: 0.4 };
  }
  return { reply: plain, shouldTransfer: false, reason: null, confidence: 0.75 };
}
