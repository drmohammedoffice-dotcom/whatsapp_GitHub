import { BillingAccessService } from './billing-access.service';

export function carryOverPeriodEnd(now: Date, planDays: number, currentPeriodEnd: Date | null | undefined): Date {
  const leftover = Math.max(0, BillingAccessService.daysRemaining(currentPeriodEnd, now) ?? 0);
  const end = new Date(now);
  end.setDate(end.getDate() + Math.max(1, planDays) + leftover);
  return end;
}

export function planDurationDays(billingCycle: 'MONTHLY' | 'YEARLY'): number {
  return billingCycle === 'YEARLY' ? 365 : 30;
}
