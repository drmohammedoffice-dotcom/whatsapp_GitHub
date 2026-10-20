'use client';

import type { ReactNode } from 'react';
import { PlanUpgradeDialog } from '@/components/billing/plan-upgrade-dialog';
import { useSubscriptionOptional } from '@/components/providers/subscription-provider';
import { planAllowsFeature, type PlanFeature } from '@/lib/plan-limits';

type PlanGateProps = {
  feature: PlanFeature;
  children: ReactNode;
};

export function PlanGate({ feature, children }: PlanGateProps) {
  const subscription = useSubscriptionOptional();
  const status = subscription?.status;
  const loading = subscription?.loading ?? false;

  if (!subscription || loading) return <>{children}</>;
  if (!status?.isActive) return <>{children}</>;
  if (planAllowsFeature(status.limits, feature)) return <>{children}</>;

  return <PlanUpgradeDialog feature={feature} />;
}
