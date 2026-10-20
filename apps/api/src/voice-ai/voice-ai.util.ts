import { createHmac, timingSafeEqual } from 'crypto';

export function normalizeE164(raw: string) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (raw.trim().startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wantsVoiceHandoff(text: string) {
  const value = text.toLowerCase();
  return (
    /موظف|دعم فني|الدعم|خدمة العملاء|بشري|انسان حقيقي|إنسان حقيقي|أحچي ويا شخص|احجي ويا شخص|اربطني/.test(value) ||
    /\b(human|real person|live agent|customer service|talk to (a )?human|support agent)\b/i.test(value)
  );
}

export function spokenReply(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>-]/g, ' ')
    .replace(/https?:\/\/\S+/gi, (url) => url.replace(/^https?:\/\//i, '').replace(/\/$/, ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

export function twimlDocument(inner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

export function buildTwilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key] ?? ''}`)
      .join('');
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}

export function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | undefined;
}) {
  if (!input.authToken || !input.signature) return false;
  const expected = buildTwilioSignature(input.authToken, input.url, input.params);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function formParams(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0];
  }
  return out;
}

export const VOICE_CALL_INSTRUCTIONS = `أنت تتحدث الآن عبر مكالمة هاتفية صوتية مع عميل Chatloora.
تحدّث بشكل طبيعي ودود باللهجة العراقية عندما يناسب، أو بالفصحى الواضحة.
اجعل الرد قصيراً (جملتان إلى أربع). لا تستخدم ماركداون ولا قوائم طويلة ولا رموز.
لا تتهجّى الروابط حرفًا حرفًا. إذا طلب واتساب الدعم قل الرقم صفر سبعة ثمانية ستة أربعة ثلاثة واحد أربعة ثلاثة ثلاثة ثلاثة، أو رابط wa.me.
اسأل سؤالاً واحداً في كل مرة. إذا طلب موظفاً بشرياً قل إنك ستحوّله فوراً.`;
