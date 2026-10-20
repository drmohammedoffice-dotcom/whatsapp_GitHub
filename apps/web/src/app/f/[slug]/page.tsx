import { Suspense } from 'react';
import PublicInstantFormClient from '@/components/instant-forms/public-form-client';
import { fetchPublicInstantForm } from '@/lib/instant-forms/api';
import type { InstantFormDocument } from '@/lib/instant-forms/document';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function PublicInstantFormPage({ params }: Props) {
  const { slug } = await params;
  let initialDocument: InstantFormDocument | null = null;
  let whatsappNumber: string | null = null;
  let seoTitle: string | null = null;
  let loadError: string | null = null;

  try {
    const data = await fetchPublicInstantForm(slug);
    initialDocument = data.document;
    whatsappNumber = data.whatsappNumber;
    seoTitle = data.seoTitle || data.name;
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Form not found';
  }

  return (
    <Suspense
      fallback={
        <div dir="rtl" className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          جاري التحميل…
        </div>
      }
    >
      <PublicInstantFormClient
        slug={slug}
        initialDocument={initialDocument}
        initialWhatsappNumber={whatsappNumber}
        initialSeoTitle={seoTitle}
        initialError={loadError}
      />
    </Suspense>
  );
}
