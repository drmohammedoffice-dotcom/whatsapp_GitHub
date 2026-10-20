import { Suspense } from 'react';
import { PricingView } from '@/components/billing/pricing-view';

export default function PricingPage() {
  return (
    <Suspense>
      <PricingView />
    </Suspense>
  );
}
