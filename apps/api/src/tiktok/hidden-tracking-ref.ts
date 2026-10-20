/** Invisible zero-width payload appended to WhatsApp prefill text. */
export const HIDDEN_REF_MARKER = '\u2060';

const ZW0 = '\u200B';
const ZW1 = '\u200C';

export function encodeHiddenTrackingRef(leadId: string): string {
  const bits = Array.from(leadId)
    .flatMap((char) => char.charCodeAt(0).toString(2).padStart(8, '0').split(''))
    .map((bit) => (bit === '1' ? ZW1 : ZW0))
    .join('');
  return `${HIDDEN_REF_MARKER}${bits}`;
}

export function decodeHiddenTrackingRef(text: string): string | null {
  const start = text.indexOf(HIDDEN_REF_MARKER);
  if (start === -1) return null;

  let payload = '';
  for (let i = start + HIDDEN_REF_MARKER.length; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ZW0) payload += '0';
    else if (ch === ZW1) payload += '1';
    else break;
  }

  if (!payload.length || payload.length % 8 !== 0) return null;

  let decoded = '';
  for (let i = 0; i < payload.length; i += 8) {
    decoded += String.fromCharCode(parseInt(payload.slice(i, i + 8), 2));
  }

  return /^[a-z0-9]{20,32}$/i.test(decoded) ? decoded : null;
}

export function stripHiddenTrackingRef(text: string): string {
  const start = text.indexOf(HIDDEN_REF_MARKER);
  if (start === -1) return text;
  let end = start + HIDDEN_REF_MARKER.length;
  while (end < text.length && (text[end] === ZW0 || text[end] === ZW1)) end += 1;
  return `${text.slice(0, start)}${text.slice(end)}`.trim();
}
