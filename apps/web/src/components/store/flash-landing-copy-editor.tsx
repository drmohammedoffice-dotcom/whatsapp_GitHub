'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FLASH_DEFAULT_COPY, mergeLandingCopy, type FlashLandingCopy } from '@/components/store/flash-landing-data';
import { api } from '@/lib/utils';
import { parseIqdAmount } from '@/lib/parse-iqd';
import type { StoreProduct } from '@/components/store/product-editor-dialog';

function lines(items: string[]) {
  return items.join('\n');
}

function splitLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border bg-background p-4" open>
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-4 grid gap-3">{children}</div>
    </details>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {rows ? (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function FlashLandingCopyEditor({
  product,
  onSaved,
}: {
  product: StoreProduct;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<FlashLandingCopy>(() => mergeLandingCopy(product.metadata?.landingCopy));
  const [unitPrice, setUnitPrice] = useState(String(product.unitPrice || 0));
  const [compareAtPrice, setCompareAtPrice] = useState(String(product.metadata?.compareAtPrice || ''));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(mergeLandingCopy(product.metadata?.landingCopy));
    setUnitPrice(String(product.metadata?.salePrice || product.unitPrice || 0));
    setCompareAtPrice(String(product.metadata?.compareAtPrice || ''));
  }, [product.id]);

  function patch(partial: Partial<FlashLandingCopy>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const price = parseIqdAmount(unitPrice);
      if (!price) throw new Error('أدخل سعر الفلاشة الحالي بأرقام واضحة، مثل 25000');
      const compare = parseIqdAmount(compareAtPrice);
      const landingCopy = {
        ...draft,
        courses: draft.courses.map((c) => ({ title: c.title, blurb: c.blurb, detail: c.detail, learn: c.learn })),
        steps: draft.steps.map((s) => ({ title: s.title, text: s.text })),
      };
      await api(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unitPrice: price,
          metadata: {
            ...(product.metadata || {}),
            salePrice: price,
            compareAtPrice: compare || undefined,
            landingCopy,
          },
        }),
      });
      setSavedAt(new Date().toLocaleTimeString('ar-IQ'));
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ السعر. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-amber-500/40 shadow-card">
      <CardHeader>
        <CardTitle>تعديل كلام صفحة الهبوط</CardTitle>
        <CardDescription>
          غيّر العناوين والنصوص وتفاصيل الدورات والسعر. بعد الحفظ حدّث صفحة الهبوط. يمكنك كتابة {'{price}'} ليظهر السعر الحالي تلقائياً.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Section title="سعر الفلاشة">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="السعر الحالي (د.ع)" value={unitPrice} onChange={setUnitPrice} />
            <Field label="السعر قبل الخصم (د.ع)" value={compareAtPrice} onChange={setCompareAtPrice} />
          </div>
          <p className="text-xs text-muted-foreground">هذا السعر يظهر في الصفحة، نموذج الطلب، ورسالة إتمام الشراء.</p>
        </Section>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Section title="أعلى الصفحة والمقدمة">
          <Field label="شريط العرض" value={draft.topBar} onChange={(topBar) => patch({ topBar })} />
          <Field label="اسم الصفحة بالشريط" value={draft.navBrand} onChange={(navBrand) => patch({ navBrand })} />
          <Field label="شارة المقدمة" value={draft.heroBadge} onChange={(heroBadge) => patch({ heroBadge })} />
          <Field label="العنوان الرئيسي" value={draft.heroTitle} onChange={(heroTitle) => patch({ heroTitle })} rows={3} />
          <Field label="الفقرة تحت العنوان" value={draft.heroLead} onChange={(heroLead) => patch({ heroLead })} rows={4} />
          <Field label="نقاط المقدمة (سطر لكل نقطة)" value={lines(draft.heroBullets)} onChange={(v) => patch({ heroBullets: splitLines(v) })} rows={4} />
          <Field label="زر الطلب" value={draft.heroCta} onChange={(heroCta) => patch({ heroCta })} />
          <Field label="زر شوف الدورات" value={draft.heroCoursesLink} onChange={(heroCoursesLink) => patch({ heroCoursesLink })} />
        </Section>

        <Section title="خطوات التوصيل">
          <Field label="عنوان القسم" value={draft.stepsTitle} onChange={(stepsTitle) => patch({ stepsTitle })} />
          {draft.steps.map((step, i) => (
            <div key={step.n} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              <Field
                label={`خطوة ${step.n} — العنوان`}
                value={step.title}
                onChange={(title) => patch({ steps: draft.steps.map((s, idx) => (idx === i ? { ...s, title } : s)) })}
              />
              <Field
                label="النص"
                value={step.text}
                onChange={(text) => patch({ steps: draft.steps.map((s, idx) => (idx === i ? { ...s, text } : s)) })}
              />
            </div>
          ))}
        </Section>

        <Section title="الدورات الـ 12">
          <Field label="عنوان قسم الدورات" value={draft.coursesTitle} onChange={(coursesTitle) => patch({ coursesTitle })} />
          <Field label="وصف القسم" value={draft.coursesSubtitle} onChange={(coursesSubtitle) => patch({ coursesSubtitle })} rows={3} />
          {draft.courses.map((course, i) => (
            <div key={course.n} className="grid gap-2 rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground">دورة {course.n}</p>
              <Field
                label="اسم الدورة"
                value={course.title}
                onChange={(title) => patch({ courses: draft.courses.map((c, idx) => (idx === i ? { ...c, title } : c)) })}
              />
              <Field
                label="ملخص قصير"
                value={course.blurb}
                onChange={(blurb) => patch({ courses: draft.courses.map((c, idx) => (idx === i ? { ...c, blurb } : c)) })}
                rows={2}
              />
              <Field
                label="التفاصيل"
                value={course.detail}
                onChange={(detail) => patch({ courses: draft.courses.map((c, idx) => (idx === i ? { ...c, detail } : c)) })}
                rows={4}
              />
              <Field
                label="شنو راح تتعلم (سطر لكل نقطة)"
                value={lines(course.learn)}
                onChange={(v) =>
                  patch({ courses: draft.courses.map((c, idx) => (idx === i ? { ...c, learn: splitLines(v) } : c)) })
                }
                rows={4}
              />
            </div>
          ))}
        </Section>

        <Section title="الفائدة والجمهور والأسئلة">
          <Field label="عنوان الفائدة" value={draft.valueTitle} onChange={(valueTitle) => patch({ valueTitle })} />
          <Field label="وصف الفائدة" value={draft.valueSubtitle} onChange={(valueSubtitle) => patch({ valueSubtitle })} rows={2} />
          {draft.benefits.map((item, i) => (
            <div key={`${item.title}-${i}`} className="grid gap-2 sm:grid-cols-2">
              <Field
                label={`فائدة ${i + 1}`}
                value={item.title}
                onChange={(title) => patch({ benefits: draft.benefits.map((b, idx) => (idx === i ? { ...b, title } : b)) })}
              />
              <Field
                label="النص"
                value={item.text}
                onChange={(text) => patch({ benefits: draft.benefits.map((b, idx) => (idx === i ? { ...b, text } : b)) })}
              />
            </div>
          ))}
          <Field label="عنوان إذا طلبت اليوم" value={draft.gainsTitle} onChange={(gainsTitle) => patch({ gainsTitle })} />
          <Field label="نقاط الطلب اليوم" value={lines(draft.gains)} onChange={(v) => patch({ gains: splitLines(v) })} rows={5} />
          <Field label="عنوان إذا أجّلت" value={draft.lossesTitle} onChange={(lossesTitle) => patch({ lossesTitle })} />
          <Field label="نقاط التأجيل" value={lines(draft.losses)} onChange={(v) => patch({ losses: splitLines(v) })} rows={5} />
          <Field label="عنوان لمن الفلاشة" value={draft.audiencesTitle} onChange={(audiencesTitle) => patch({ audiencesTitle })} />
          {draft.audiences.map((item, i) => (
            <div key={`${item.title}-${i}`} className="grid gap-2 sm:grid-cols-2">
              <Field
                label={`جمهور ${i + 1}`}
                value={item.title}
                onChange={(title) => patch({ audiences: draft.audiences.map((b, idx) => (idx === i ? { ...b, title } : b)) })}
              />
              <Field
                label="النص"
                value={item.text}
                onChange={(text) => patch({ audiences: draft.audiences.map((b, idx) => (idx === i ? { ...b, text } : b)) })}
              />
            </div>
          ))}
          <Field label="عنوان الأسئلة" value={draft.faqTitle} onChange={(faqTitle) => patch({ faqTitle })} />
          {draft.faqs.map((item, i) => (
            <div key={`${item.q}-${i}`} className="grid gap-2">
              <Field
                label={`سؤال ${i + 1}`}
                value={item.q}
                onChange={(q) => patch({ faqs: draft.faqs.map((f, idx) => (idx === i ? { ...f, q } : f)) })}
              />
              <Field
                label="الجواب"
                value={item.a}
                onChange={(a) => patch({ faqs: draft.faqs.map((f, idx) => (idx === i ? { ...f, a } : f)) })}
                rows={3}
              />
            </div>
          ))}
        </Section>

        <Section title="الطلب والفيديوهات">
          <Field label="عنوان نموذج الطلب" value={draft.orderTitle} onChange={(orderTitle) => patch({ orderTitle })} />
          <Field label="وصف الطلب" value={draft.orderHint} onChange={(orderHint) => patch({ orderHint })} rows={2} />
          <Field label="عنوان الفيديوهات" value={draft.videosTitle} onChange={(videosTitle) => patch({ videosTitle })} rows={2} />
          <Field label="وصف الفيديوهات" value={draft.videosSubtitle} onChange={(videosSubtitle) => patch({ videosSubtitle })} rows={2} />
          <Field label="عنوان الفيديو الأول" value={draft.videoOneTitle} onChange={(videoOneTitle) => patch({ videoOneTitle })} />
          <Field label="عنوان الفيديو الثاني" value={draft.videoTwoTitle} onChange={(videoTwoTitle) => patch({ videoTwoTitle })} />
          <Field label="زر أسفل الموبايل" value={draft.stickyCta} onChange={(stickyCta) => patch({ stickyCta })} />
        </Section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'جاي نحفظ...' : 'حفظ كلام الصفحة'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDraft(FLASH_DEFAULT_COPY)}>
            إرجاع النص الأصلي
          </Button>
          {savedAt ? <p className="text-sm text-emerald-700">تم الحفظ الساعة {savedAt}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
