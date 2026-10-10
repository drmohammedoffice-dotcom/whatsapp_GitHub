import { BillingInterval } from '@watsapp/database';
import { carryOverPeriodEnd, planDurationDays } from './billing-carryover';

describe('billing remaining-days carryover', () => {
  it('adds leftover days to a new monthly plan (10 + 30 = 40)', () => {
    const now = new Date('2026-09-05T12:00:00Z');
    const remainingEnd = new Date('2026-09-15T12:00:00Z');
    const result = carryOverPeriodEnd(now, planDurationDays(BillingInterval.MONTHLY), remainingEnd);
    const days = Math.round((result.getTime() - now.getTime()) / 86_400_000);
    expect(days).toBe(40);
  });

  it('does not add days when the previous period already ended', () => {
    const now = new Date('2026-09-05T12:00:00Z');
    const expired = new Date('2026-08-01T12:00:00Z');
    const result = carryOverPeriodEnd(now, 30, expired);
    const days = Math.round((result.getTime() - now.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });
});
