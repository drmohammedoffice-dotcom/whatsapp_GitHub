/** Shared helpers for Chatloora-style subscription payment proof (email + transfer receipt). */

export const DEFAULT_MASTERCARD = '2606424980';

export type SubscriptionPackage = {
  key: 'basic' | 'pro' | 'business';
  label: string;
  amountIqd: number;
  amountUsd: number;
  ordinal: 1 | 2 | 3;
};

export const SUBSCRIPTION_PACKAGES: SubscriptionPackage[] = [
  { key: 'basic', label: 'الأساسية', amountIqd: 22_800, amountUsd: 15, ordinal: 1 },
  { key: 'pro', label: 'الاحترافية', amountIqd: 38_000, amountUsd: 25, ordinal: 2 },
  { key: 'business', label: 'الأعمال', amountIqd: 74_480, amountUsd: 49, ordinal: 3 },
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** IQD match tolerance (receipt OCR noise). */
export const AMOUNT_IQD_TOLERANCE = 1_500;
/** USD match tolerance. */
export const AMOUNT_USD_TOLERANCE = 1;

export function extractEmails(text: string | null | undefined): string[] {
  const matches = String(text || '').match(EMAIL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const email = raw.trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function extractMastercardFromTraining(training: string | null | undefined): string {
  const text = String(training || '');
  const m =
    /(?:ماستركارد|mastercard|ماستر\s*كارد)[^\d]{0,40}(\d{10,16})/i.exec(text) ||
    /\b(2606424980)\b/.exec(text) ||
    /\b(\d{10,16})\b/.exec(text);
  return m?.[1] || DEFAULT_MASTERCARD;
}

/**
 * Detect which package the customer chose.
 * Ordinals: الأولى=15$ الأساسية, الثانية=25$ الاحترافية, الثالثة=49$ الأعمال.
 * Do NOT pass full Training Studio text (it lists all packages and would false-match).
 */
export function detectSubscriptionPackage(text: string | null | undefined): SubscriptionPackage | null {
  const t = String(text || '');
  if (!t.trim()) return null;

  // Ordinal / "first|second|third package" — checked first (avoid bare digits that match 15/25/49).
  if (
    /باق[ةه]\s*(الأولى|الاولى|الاولي|الأولي|رقم\s*1\b)|الباقة\s*الأولى|أريد\s*الأولى|(?:^|\s)(الأولى|الاولى)(?:\s|[!.?؟]|$)/i.test(
      t,
    )
  ) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'basic')!;
  }
  if (
    /باق[ةه]\s*(الثانية|الثانيه|رقم\s*2\b)|الباقة\s*الثانية|أريد\s*الثانية|(?:^|\s)(الثانية|الثانيه)(?:\s|[!.?؟]|$)/i.test(
      t,
    )
  ) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'pro')!;
  }
  if (
    /باق[ةه]\s*(الثالثة|الثالثه|رقم\s*3\b)|الباقة\s*الثالثة|أريد\s*الثالثة|(?:^|\s)(الثالثة|الثالثه)(?:\s|[!.?؟]|$)/i.test(
      t,
    )
  ) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'business')!;
  }

  if (/أعمال|الاعمال|الأعمال|business|49\s*\$|49\s*دولار|68[,.]?000/i.test(t)) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'business')!;
  }
  if (/احتراف|الاحترافية|pro|professional|25\s*\$|25\s*دولار|35[,.]?000/i.test(t)) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'pro')!;
  }
  if (/أساسية|الاساسية|الأساسية|basic|15\s*\$|15\s*دولار|22[,.]?000/i.test(t)) {
    return SUBSCRIPTION_PACKAGES.find((p) => p.key === 'basic')!;
  }
  return null;
}

/** True when the customer is naming/choosing a package (not a general details question). */
export function looksLikePackageChoice(message: string | null | undefined): boolean {
  const m = String(message || '').trim();
  if (!m) return false;
  if (detectSubscriptionPackage(m)) return true;
  return /باق[ةه]|الأولى|الاولى|الثانية|الثالثة|أساسية|احتراف|أعمال/i.test(m);
}

/** True when the turn looks like payment proof (email and/or transfer receipt). */
export function looksLikeSubscriptionProofTurn(message: string | null | undefined): boolean {
  const m = String(message || '').trim();
  if (!m) return false;
  if (extractEmails(m).length > 0) return true;
  if (looksLikePackageChoice(m)) return true;
  return /وصل|تحويل|إيصال|ايصال|صورة\s*التحويل|ارسلت\s*(ال)?تحويل|دفعت|حو[ّ']?لت|receipt|transfer|payment\s*proof/i.test(
    m,
  );
}

/** Parse a numeric amount from vision OCR text (IQD or USD). */
export function parseAmountNumber(amountSeen: string | null | undefined): number | null {
  if (amountSeen == null) return null;
  const raw = String(amountSeen).replace(/,/g, '').replace(/\s+/g, '');
  const m = /(\d+(?:\.\d+)?)/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function amountMatchesPackage(
  amountSeen: string | null | undefined,
  pkg: SubscriptionPackage,
): boolean {
  const n = parseAmountNumber(amountSeen);
  if (n == null) return false;
  // Small numbers are treated as USD.
  if (n <= 200) {
    return Math.abs(n - pkg.amountUsd) <= AMOUNT_USD_TOLERANCE;
  }
  return Math.abs(n - pkg.amountIqd) <= AMOUNT_IQD_TOLERANCE;
}

/** Infer package from transferred amount when customer did not name one. */
export function inferPackageFromAmount(amountSeen: string | null | undefined): SubscriptionPackage | null {
  const n = parseAmountNumber(amountSeen);
  if (n == null) return null;
  if (n <= 200) {
    return (
      SUBSCRIPTION_PACKAGES.find((p) => Math.abs(p.amountUsd - n) <= AMOUNT_USD_TOLERANCE) ?? null
    );
  }
  let best: SubscriptionPackage | null = null;
  let bestDiff = Infinity;
  for (const p of SUBSCRIPTION_PACKAGES) {
    const diff = Math.abs(p.amountIqd - n);
    if (diff <= AMOUNT_IQD_TOLERANCE && diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

export function buildSubscriptionThankYouMessage(
  email: string,
  pkg: SubscriptionPackage | null,
  activated: boolean,
): string {
  const packLine = pkg
    ? `\nالباقة المفعّلة: ${pkg.label} (${pkg.amountUsd}$ = ${pkg.amountIqd.toLocaleString('en-US')} دينار)`
    : '';
  if (activated) {
    return [
      'شكرًا جزيلاً على اشتراكك 🌺',
      '',
      `تم تأكيد التحويل وتفعيل اشتراكك على الإيميل (${email}).${packLine}`,
      '',
      'تقدر تدخل للمنصة الآن وتبدأ الاستخدام مباشرة.',
    ].join('\n');
  }
  return [
    'شكرًا جزيلاً على اشتراكك 🌺',
    '',
    `استلمنا بريدك الإلكتروني (${email}) وصورة التحويل.${packLine}`,
    '',
    'يرجى الانتظار قليلاً لحين تأكيد وصول مبلغ الاشتراك، وبعدها يتم تفعيل اشتراكك مباشرة.',
  ].join('\n');
}

export function buildSubscriptionAskEmailMessage(): string {
  return [
    'شكرًا لإرسال صورة التحويل 🌺',
    '',
    'لطفاً أرسل لنا الآن الإيميل (البريد الإلكتروني) اللي سجّلت بيه حسابك في المنصة، حتى نربط الاشتراك ونفعّله بعد تأكيد وصول المبلغ.',
  ].join('\n');
}

export function buildSubscriptionAskPackageMessage(email?: string | null): string {
  const emailLine = email ? `للإيميل (${email})\n\n` : '';
  return [
    'تمام، استلمنا وصل التحويل ✅',
    '',
    `${emailLine}لطفاً حدّد الباقة التي تريد الاشتراك بها:`,
    '',
    '1️⃣ الأساسية — 15$ = 22,800 دينار عراقي',
    '2️⃣ الاحترافية — 25$ = 38,000 دينار عراقي',
    '3️⃣ الأعمال — 49$ = 74,480 دينار عراقي',
    '',
    'تقدر تكتب: الباقة الأولى / الثانية / الثالثة أو اسم الباقة.',
  ].join('\n');
}

export function buildSubscriptionAskReceiptMessage(
  email: string,
  pkg?: SubscriptionPackage | null,
): string {
  const packHint = pkg
    ? `للباقة التي اخترتها (${pkg.label} — ${pkg.amountUsd}$ / ${pkg.amountIqd.toLocaleString('en-US')} دينار).`
    : 'بحسب الباقة التي تريد الاشتراك بها (الأساسية 15$ / الاحترافية 25$ / الأعمال 49$).';
  return [
    `شكرًا، استلمنا إيميلك (${email}) ✅`,
    '',
    `لطفاً أرسل الآن صورة واضحة لوصل تحويل مبلغ الاشتراك ${packHint}`,
    '',
    'وبعدها حدّد أي باقة تريد إن ما حدّدتها بعد، حتى نطابق المبلغ ونفعّل اشتراكك.',
  ].join('\n');
}

export function buildSubscriptionAmountMismatchMessage(
  pkg: SubscriptionPackage,
  amountSeen: string | null | undefined,
): string {
  const seen = amountSeen?.trim() || 'غير واضح';
  return [
    `مبلغ التحويل الظاهر في الصورة (${seen}) لا يطابق سعر الباقة التي اخترتها.`,
    '',
    `الباقة: ${pkg.label}`,
    `المبلغ المطلوب: ${pkg.amountUsd}$ = ${pkg.amountIqd.toLocaleString('en-US')} دينار عراقي`,
    '',
    'لطفاً حوّل المبلغ الكامل للباقة وأعد إرسال وصل التحويل، أو اختر باقة تطابق المبلغ الذي حوّلته.',
  ].join('\n');
}

export function buildSubscriptionRejectReceiptMessage(reason?: string | null): string {
  const extra = reason?.trim() ? `\n\n(${reason.trim()})` : '';
  return `ما قدرت أتأكد إن الصورة وصل تحويل حقيقي على رقم الماستركارد الخاص بالاشتراك.${extra}\n\nلطفاً أعد إرسال صورة أوضح يظهر فيها رقم الماستركارد ومبلغ التحويل.`;
}

export function buildSubscriptionUserNotFoundMessage(email: string): string {
  return [
    `ما لقينا حساب مسجّل بالإيميل (${email}) في المنصة.`,
    '',
    'لطفاً سجّل حساب جديد على الموقع أولاً:',
    'www.chatloora.com',
    '',
    'وبعدها أرسل لنا نفس الإيميل مع صورة التحويل والباقة حتى نفعّل الاشتراك.',
  ].join('\n');
}

export function buildSubscriptionOrderNotes(input: {
  email: string;
  packageLabel: string;
  mastercard: string;
  receiptMessageId: string;
  mediaStorageKey: string;
  visionSummary?: string | null;
  activated?: boolean;
  amountMatched?: boolean;
}): string {
  return [
    'طلب اشتراك منصة',
    `البريد: ${input.email}`,
    `الباقة: ${input.packageLabel}`,
    `الماستركارد: ${input.mastercard}`,
    `صورة التحويل: messageId=${input.receiptMessageId}`,
    `mediaKey=${input.mediaStorageKey}`,
    input.amountMatched != null ? `مطابقة المبلغ: ${input.amountMatched ? 'نعم' : 'لا'}` : null,
    input.activated != null ? `تفعيل تلقائي: ${input.activated ? 'نعم' : 'لا'}` : null,
    input.visionSummary ? `التحقق: ${input.visionSummary}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export type VisionReceiptVerdict = {
  isTransferReceipt: boolean;
  matchesCard: boolean;
  cardNumberSeen?: string | null;
  amountSeen?: string | null;
  confidence: number;
  reason?: string | null;
};

export function parseVisionReceiptVerdict(raw: string): VisionReceiptVerdict {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      isTransferReceipt: Boolean(parsed.isTransferReceipt ?? parsed.is_receipt ?? parsed.valid),
      matchesCard: Boolean(parsed.matchesCard ?? parsed.matches_card ?? parsed.cardMatch),
      cardNumberSeen: parsed.cardNumberSeen != null ? String(parsed.cardNumberSeen) : null,
      amountSeen: parsed.amountSeen != null ? String(parsed.amountSeen) : null,
      confidence: Number(parsed.confidence ?? 0.5) || 0.5,
      reason: parsed.reason != null ? String(parsed.reason) : null,
    };
  } catch {
    const lower = text.toLowerCase();
    const ok = /"matchesCard"\s*:\s*true|"isTransferReceipt"\s*:\s*true/i.test(text);
    return {
      isTransferReceipt: ok || /receipt|تحويل|وصل/i.test(text),
      matchesCard: ok || lower.includes(DEFAULT_MASTERCARD),
      confidence: 0.4,
      reason: text.slice(0, 200),
    };
  }
}
