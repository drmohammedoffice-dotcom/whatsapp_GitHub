export function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function toIraqWhatsAppE164(raw: string) {
  const digits = digitsOnly(raw);
  if (!digits) return '9647864314333';
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('0')) return `964${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('7')) return `964${digits}`;
  return digits;
}

export function supportWhatsAppUrl(phone: string, text?: string) {
  const e164 = toIraqWhatsAppE164(phone);
  const base = `https://wa.me/${e164}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim().slice(0, 600))}`;
}

export function wantsHumanSupport(text: string) {
  const value = text.toLowerCase();
  return (
    /موظف|دعم فني|الدعم|خدمة العملاء|بشري|انسان حقيقي|إنسان حقيقي|ما اريد الذكاء|ما أريد الذكاء|احجي ويا شخص|أحچي ويا شخص|ابي انسان|أبي إنسان|ما اريد احجي ويا ai|ما أريد أحچي ويا ai/.test(value) ||
    /\b(human|real person|live agent|customer service|talk to (a )?human|support agent)\b/i.test(value)
  );
}

export function looksUnanswered(reply: string) {
  return /ما لقيت جواب مؤكد|غير دقيقة|لا أعرف|لا اعرف|I don't have (a )?confirmed|not sure|cannot find/i.test(reply);
}

export function retrieveArticleScore(query: string, article: { titleAr: string; titleEn: string; keywords: string[]; bodyAr: string; bodyEn: string }) {
  const q = query.toLowerCase();
  const hay = `${article.titleAr} ${article.titleEn} ${article.keywords.join(' ')} ${article.bodyAr} ${article.bodyEn}`.toLowerCase();
  const tokens = q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 2;
    if (article.keywords.some((k) => k.toLowerCase().includes(token) || token.includes(k.toLowerCase()))) score += 3;
    if (article.titleAr.toLowerCase().includes(token) || article.titleEn.toLowerCase().includes(token)) score += 4;
  }
  return score;
}
