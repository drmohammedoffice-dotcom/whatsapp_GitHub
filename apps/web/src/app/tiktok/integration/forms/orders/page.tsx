'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { InstantFormOrdersPageClient } from './orders-client';

export default function InstantFormOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          …
        </div>
      }
    >
      <InstantFormOrdersPageClient />
    </Suspense>
  );
}
