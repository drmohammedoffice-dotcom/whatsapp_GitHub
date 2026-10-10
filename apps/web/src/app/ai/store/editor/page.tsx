'use client';

import { AuthGuard } from '@/components/layout/auth-guard';
import { PlanGate } from '@/components/billing/plan-gate';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { StoreVisualEditor } from '@/components/store/store-visual-editor';

export default function StoreVisualEditorPage() {
  return (
    <AuthGuard>
      <SubscriptionProvider>
        <PlanGate feature="ai">
          <StoreVisualEditor />
        </PlanGate>
      </SubscriptionProvider>
    </AuthGuard>
  );
}
