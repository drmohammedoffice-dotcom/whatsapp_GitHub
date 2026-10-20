import { OfficialNotificationType } from '@watsapp/database';
import { dateOnlyUtc, maskToken, normalizeWaDigits } from '../official-whatsapp.util';

describe('official WhatsApp helpers', () => {
  it('normalizes and masks phone numbers', () => {
    expect(normalizeWaDigits('+964 786 431 4333')).toBe('9647864314333');
    expect(normalizeWaDigits('abc')).toBe('');
  });

  it('never returns a full access token preview', () => {
    const token = 'EAAG'.padEnd(80, 'x') + 'SECRET';
    const preview = maskToken(token);
    expect(preview).toBe('stored');
    expect(preview).not.toContain('SECRET');
    expect(preview).not.toContain('EAAG');
  });

  it('builds a date-only idempotency key', () => {
    const a = dateOnlyUtc(new Date('2026-09-14T23:10:00Z'));
    const b = dateOnlyUtc(new Date('2026-09-14T01:00:00Z'));
    expect(a.toISOString().slice(0, 10)).toBe(b.toISOString().slice(0, 10));
  });

  it('keeps official notification types distinct from customer inbox traffic', () => {
    expect(OfficialNotificationType.ACCOUNT_VERIFICATION_OTP).toBe('ACCOUNT_VERIFICATION_OTP');
    expect(OfficialNotificationType.SUBSCRIPTION_EXPIRED).toBe('SUBSCRIPTION_EXPIRED');
  });
});
