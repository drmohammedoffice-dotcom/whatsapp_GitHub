'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/shared/alert-banner';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getLandingCopy, type LandingCopy } from '@/lib/i18n/landing-copy';
import {
  DEFAULT_LANDING_VISIBILITY,
  deepMergeLanding,
  normalizeLandingVisibility,
  type LandingVisibility,
} from '@/lib/landing-content';
import { fetchAdminLanding, resetAdminLanding, saveAdminLanding } from '@/lib/admin-api';
import { parseApiError } from '@/lib/utils';

const SECTION_KEYS = [
  'seo',
  'nav',
  'hero',
  'problems',
  'features',
  'tiktok',
  'how',
  'video',
  'testimonials',
  'stats',
  'trial',
  'pricing',
  'faq',
  'contact',
  'footer',
] as const;

const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  seo: 'SEO',
  nav: 'شريط التنقل',
  hero: 'الهيرو',
  problems: 'المشكلة',
  features: 'المميزات',
  tiktok: 'تيك توك',
  how: 'طريقة العمل',
  video: 'الفيديو',
  testimonials: 'آراء العملاء',
  stats: 'الإحصائيات',
  trial: 'التجربة المجانية',
  pricing: 'الأسعار',
  faq: 'الأسئلة الشائعة',
  contact: 'تواصل معنا',
  footer: 'الفوتر',
};

const VISIBILITY_KEYS = Object.keys(DEFAULT_LANDING_VISIBILITY) as Array<keyof LandingVisibility>;

const FIELD_LABELS: Record<string, string> = {
  title: 'العنوان',
  titleLine1: 'العنوان سطر 1',
  titleLine2: 'العنوان سطر 2',
  subtitle: 'الوصف',
  eyebrow: 'التسمية العلوية',
  badge: 'الشارة',
  cta: 'زر الإجراء',
  ctaPrimary: 'الزر الأساسي',
  ctaSecondary: 'الزر الثانوي',
  description: 'الوصف',
  quote: 'الاقتباس',
  name: 'الاسم',
  role: 'الدور',
  company: 'الشركة',
  industry: 'القطاع',
  value: 'القيمة',
  suffix: 'اللاحقة',
  label: 'التسمية',
  q: 'السؤال',
  a: 'الجواب',
  desc: 'الوصف',
  price: 'السعر',
  features: 'المميزات',
  items: 'العناصر',
  steps: 'الخطوات',
  bullets: 'النقاط',
  plans: 'الباقات',
  whatsappNumber: 'رقم واتساب',
  supportEmail: 'بريد الدعم',
  whatsapp: 'نص واتساب',
  email: 'نص البريد',
  social: 'نص السوشيال',
  home: 'الرئيسية',
  login: 'تسجيل الدخول',
  startTrial: 'ابدأ التجربة',
  signInWeb: 'تسجيل الدخول من الويب',
};

function labelFor(key: string) {
  return FIELD_LABELS[key] || key;
}

function blankItemLike(sample: unknown): unknown {
  if (typeof sample === 'string') return '';
  if (typeof sample === 'number') return 0;
  if (typeof sample === 'boolean') return false;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sample as Record<string, unknown>)) {
      out[k] = blankItemLike(v);
    }
    return out;
  }
  return '';
}

function ValueEditor({
  value,
  onChange,
  path,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  path: string;
}) {
  const { t } = useTranslation();

  if (typeof value === 'string') {
    const multiline = value.length > 80 || value.includes('\n') || path.endsWith('.subtitle') || path.endsWith('.a') || path.endsWith('.quote') || path.endsWith('.description');
    if (multiline) {
      return <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />;
    }
    return <Input value={value} onChange={(e) => onChange(e.target.value)} dir="auto" />;
  }

  if (typeof value === 'number') {
    return (
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {value ? 'نعم' : 'لا'}
      </label>
    );
  }

  if (Array.isArray(value)) {
    const sample = value[0];
    return (
      <div className="space-y-3">
        {value.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.landing.emptyArray')}</p>}
        {value.map((item, index) => (
          <Card key={`${path}-${index}`} className="border bg-muted/20">
            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">#{index + 1}</p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...value];
                      const tmp = next[index - 1];
                      next[index - 1] = next[index];
                      next[index] = tmp;
                      onChange(next);
                    }}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index >= value.length - 1}
                    onClick={() => {
                      const next = [...value];
                      const tmp = next[index + 1];
                      next[index + 1] = next[index];
                      next[index] = tmp;
                      onChange(next);
                    }}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <ValueEditor
                value={item}
                path={`${path}[${index}]`}
                onChange={(nextItem) => {
                  const next = [...value];
                  next[index] = nextItem;
                  onChange(next);
                }}
              />
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, blankItemLike(sample ?? '')])}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('admin.landing.addItem')}
        </Button>
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="space-y-4">
        {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
          <div key={key} className="space-y-1.5">
            <Label>{labelFor(key)}</Label>
            <ValueEditor
              value={child}
              path={`${path}.${key}`}
              onChange={(nextChild) =>
                onChange({
                  ...(value as Record<string, unknown>),
                  [key]: nextChild,
                })
              }
            />
          </div>
        ))}
      </div>
    );
  }

  return <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}

export default function AdminLandingPage() {
  const { t } = useTranslation();
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [contentEn, setContentEn] = useState<LandingCopy>(getLandingCopy('en'));
  const [contentAr, setContentAr] = useState<LandingCopy>(getLandingCopy('ar'));
  const [visibility, setVisibility] = useState<LandingVisibility>(DEFAULT_LANDING_VISIBILITY);
  const [section, setSection] = useState<(typeof SECTION_KEYS)[number]>('hero');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeContent = locale === 'ar' ? contentAr : contentEn;
  const sectionData = useMemo(() => (activeContent as Record<string, unknown>)[section], [activeContent, section]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminLanding();
      setContentEn(deepMergeLanding(getLandingCopy('en'), data.contentEn));
      setContentAr(deepMergeLanding(getLandingCopy('ar'), data.contentAr));
      setVisibility(normalizeLandingVisibility(data.visibility));
    } catch (err) {
      setError(parseApiError(err));
      setContentEn(getLandingCopy('en'));
      setContentAr(getLandingCopy('ar'));
      setVisibility(DEFAULT_LANDING_VISIBILITY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateSection(next: unknown) {
    if (locale === 'ar') {
      setContentAr((prev) => ({ ...prev, [section]: next } as LandingCopy));
    } else {
      setContentEn((prev) => ({ ...prev, [section]: next } as LandingCopy));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveAdminLanding({
        contentEn: contentEn as unknown as Record<string, unknown>,
        contentAr: contentAr as unknown as Record<string, unknown>,
        visibility,
      });
      setNotice(t('admin.landing.saved'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(t('admin.landing.resetConfirm'))) return;
    setBusy(true);
    setError(null);
    try {
      await resetAdminLanding();
      setContentEn(getLandingCopy('en'));
      setContentAr(getLandingCopy('ar'));
      setVisibility(DEFAULT_LANDING_VISIBILITY);
      setNotice(t('admin.landing.saved'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.landing.pageTitle')}
        description={t('admin.landing.pageDesc')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="me-2 h-4 w-4" />
                {t('admin.landing.preview')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void reset()}>
              <RotateCcw className="me-2 h-4 w-4" />
              {t('admin.landing.reset')}
            </Button>
            <Button size="sm" disabled={busy || loading} onClick={() => void save()}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {t('admin.landing.save')}
            </Button>
          </div>
        }
      />

      {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-2 pt-4">
                <p className="text-xs font-medium text-muted-foreground">{t('admin.landing.sections')}</p>
                <div className="flex flex-col gap-1">
                  {SECTION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-lg px-3 py-2 text-start text-sm ${
                        section === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSection(key)}
                    >
                      {SECTION_LABELS[key]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-4">
                <p className="text-xs font-medium text-muted-foreground">{t('admin.landing.visibility')}</p>
                {VISIBILITY_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{SECTION_LABELS[key as (typeof SECTION_KEYS)[number]] ?? key}</span>
                    <input
                      type="checkbox"
                      checked={visibility[key]}
                      onChange={(e) => setVisibility((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                  </label>
                ))}
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={locale === 'ar' ? 'default' : 'outline'} onClick={() => setLocale('ar')}>
                {t('admin.landing.localeAr')}
              </Button>
              <Button type="button" size="sm" variant={locale === 'en' ? 'default' : 'outline'} onClick={() => setLocale('en')}>
                {t('admin.landing.localeEn')}
              </Button>
            </div>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h2 className="text-lg font-semibold">{SECTION_LABELS[section]}</h2>
                  <p className="text-sm text-muted-foreground">
                    {locale === 'ar' ? 'تعديل النسخة العربية' : 'Edit English copy'}
                  </p>
                </div>
                <ValueEditor value={sectionData} path={section} onChange={updateSection} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
