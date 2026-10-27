'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BillingCycle, BillingPlan, CheckoutResult, SubscriptionState } from '@/lib/billing';
import { fetchSubscriptionStatus } from '@/lib/billing';
import { setSubscriptionCookie } from '@/lib/subscription-cookie';
import { api, getAccessToken } from '@/lib/utils';

type SubscriptionContextValue = {
  status: SubscriptionState | null;
  plans: BillingPlan[];
  loading: boolean;
  refresh: () => Promise<SubscriptionState | null>;
  checkout: (planSlug: string, billingCycle: BillingCycle) => Promise<CheckoutResult>;
  confirmPayment: (paymentId: string) => Promise<SubscriptionState | null>;
};

const defaultStatus: SubscriptionState = {
  hasSubscription: false,
  subscriptionStatus: null,
  plan: null,
  planSlug: null,
  planName: null,
  limits: null,
  trackingPhoneCount: 0,
  canAddTrackingPhone: false,
  whatsappInboxCount: 0,
  canAddWhatsappNumber: false,
  tiktokPixelCount: 0,
  canAddTiktokPixel: false,
  teamMemberCount: 0,
  canAddTeamMember: false,
  overLimit: {
    trackingPhones: false,
    whatsappNumbers: false,
    tiktokPixels: false,
    teamMembers: false,
  },
  billingCycle: null,
  autoRenew: false,
  trialExpired: false,
  isFreeTrial: false,
  freeTrialEnded: false,
  isActive: false,
  isExpired: true,
  isInGracePeriod: false,
  graceHoursRemaining: null,
  graceDaysRemaining: null,
  gracePurged: false,
  daysRemaining: null,
  showExpiryWarning: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  expiredAt: null,
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

let cachedStatus: SubscriptionState | null = null;
let cachedPlans: BillingPlan[] = [];

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SubscriptionState | null>(cachedStatus);
  const [plans, setPlans] = useState<BillingPlan[]>(cachedPlans);
  const [loading, setLoading] = useState(cachedStatus === null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSubscriptionStatus();
      cachedStatus = next;
      setStatus(next);
      setSubscriptionCookie(next.isActive);
      return next;
    } catch {
      // Do not mark inactive on transient API errors — keep last known state.
      return cachedStatus;
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const list = await api<BillingPlan[]>('/billing/plans');
      cachedPlans = list;
      setPlans(list);
    } catch {
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      if (!cachedStatus) setLoading(true);
      await Promise.all([refresh(), loadPlans()]);
      if (!cancelled) setLoading(false);
    })();
    const timer = window.setInterval(() => void refresh(), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadPlans, refresh]);

  const checkout = useCallback(async (planSlug: string, billingCycle: BillingCycle) => {
    return api<CheckoutResult>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({
        planSlug,
        billingCycle,
      }),
    });
  }, []);

  const confirmPayment = useCallback(async (paymentId: string) => {
    const next = await api<SubscriptionState>('/billing/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    });
    setStatus(next);
    setSubscriptionCookie(next.isActive);
    return next;
  }, []);

  const value = useMemo(
    () => ({ status, plans, loading, refresh, checkout, confirmPayment }),
    [status, plans, loading, refresh, checkout, confirmPayment],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

export function useSubscriptionOptional() {
  return useContext(SubscriptionContext);
}
