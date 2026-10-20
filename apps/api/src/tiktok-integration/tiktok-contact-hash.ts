import { createHash } from 'crypto';

/** Normalize phone to digits only (E.164 without +), then SHA-256 hex for TikTok Events API. */
export function hashTikTokPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return createHash('sha256').update(digits).digest('hex');
}
