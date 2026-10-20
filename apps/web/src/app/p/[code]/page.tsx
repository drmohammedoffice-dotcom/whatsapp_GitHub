'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { saveReferral } from '@/lib/referral';
import { LoadingBlock } from '@/components/shared/loading-block';

export default function PartnerReferralLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    const code = String(params.code ?? '').trim();
    if (code) saveReferral(code, 'LINK');
    router.replace('/register');
  }, [params.code, router]);

  return <LoadingBlock className="min-h-[50vh]" />;
}
