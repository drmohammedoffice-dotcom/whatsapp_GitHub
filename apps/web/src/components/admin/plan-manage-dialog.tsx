'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  createAdminPlan,
  deleteAdminPlan,
  fetchAdminFeatureDefinitions,
  updateAdminPlan,
  type AdminPlanRow,
} from '@/lib/admin-api';
import { formatPrice } from '@/lib/billing';
import { isHiddenPlanFeature } from '@/lib/plan-limits';

type FeatureDef = {
  key: string;
  category: string;
  valueType: 'BOOLEAN' | 'LIMIT';
  nameAr: string;
  nameEn: string;
  /** Set by the API for features removed from the product. */
  retired?: boolean;
};

type LimitMode = 'disabled' | 'limited' | 'unlimited';

type EntitlementState = {
  enabled: boolean;
  mode: LimitMode;
  limit: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AdminPlanRow | null;
  onSaved: () => void;
};

function centsFromDollars(value: string) {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function dollarsFromCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

function defaultState(feature: FeatureDef, plan: AdminPlanRow | null): EntitlementState {
  const row = plan?.entitlements?.find((item) => item.key === feature.key);
  if (feature.valueType === 'BOOLEAN') {
    return { enabled: Boolean(row?.enabled), mode: 'limited', limit: '' };
  }
  const value = row?.limitValue ?? 0;
  if (!row?.enabled || value === 0) return { enabled: false, mode: 'disabled', limit: '0' };
  if (value < 0) return { enabled: true, mode: 'unlimited', limit: '' };
  return { enabled: true, mode: 'limited', limit: String(value) };
}

const CATEGORY_ORDER = ['whatsapp', 'tiktok', 'whatsapp_api', 'social', 'ai', 'team', 'other'];

export function PlanManageDialog({ open, onOpenChange, plan, onSaved }: Props) {
  const { t, locale } = useTranslation();
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [slug, setSlug] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [yearlyPrice, setYearlyPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [trialDays, setTrialDays] = useState('14');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isRecommended, setIsRecommended] = useState(false);
  const [values, setValues] = useState<Record<string, EntitlementState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchAdminFeatureDefinitions()
      .then((defs) => setFeatures(defs))
      .catch(() => setFeatures([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSlug(plan?.slug ?? '');
    setNameAr(plan?.nameAr ?? plan?.name ?? '');
    setNameEn(plan?.nameEn ?? plan?.name ?? '');
    setDescriptionAr(plan?.descriptionAr ?? plan?.description ?? '');
    setDescriptionEn(plan?.descriptionEn ?? plan?.description ?? '');
    setMonthlyPrice(plan ? dollarsFromCents(plan.priceCents) : '');
    setYearlyPrice(
      plan ? dollarsFromCents(plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8)) : '',
    );
    setCurrency(plan?.currency ?? 'USD');
    setTrialDays(String(plan?.trialDays ?? 14));
    setSortOrder(String(plan?.sortOrder ?? 0));
    setIsActive(plan?.isActive ?? true);
    setIsRecommended(plan?.isRecommended ?? false);
    setError(null);
  }, [open, plan]);

  useEffect(() => {
    if (!open || features.length === 0) return;
    const next: Record<string, EntitlementState> = {};
    for (const feature of features) next[feature.key] = defaultState(feature, plan);
    setValues(next);
  }, [open, plan, features]);

  /**
   * Retired / unenforced features are not editable. They are still sent back
   * unchanged on save (see `entitlements` below) so nothing is silently reset.
   */
  const visibleFeatures = useMemo(
    () => features.filter((feature) => !isHiddenPlanFeature(feature)),
    [features],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureDef[]>();
    for (const feature of visibleFeatures) {
      const list = map.get(feature.category) ?? [];
      list.push(feature);
      map.set(feature.category, list);
    }
    return CATEGORY_ORDER.filter((key) => map.has(key)).map((key) => ({
      key,
      items: map.get(key) ?? [],
    }));
  }, [visibleFeatures]);

  const previewBullets = useMemo(() => {
    return visibleFeatures.map((feature) => {
      const state = values[feature.key];
      const label = locale === 'ar' ? feature.nameAr : feature.nameEn;
      if (!state) return { label, included: false, detail: '' };
      if (feature.valueType === 'BOOLEAN') {
        return { label, included: state.enabled, detail: '' };
      }
      if (state.mode === 'disabled') return { label, included: false, detail: '' };
      if (state.mode === 'unlimited') {
        return { label, included: true, detail: locale === 'ar' ? 'غير محدود' : 'Unlimited' };
      }
      return { label, included: true, detail: state.limit || '0' };
    });
  }, [visibleFeatures, values, locale]);

  function setFeature(key: string, patch: Partial<EntitlementState>) {
    setValues((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  async function save() {
    if (!slug.trim() || !nameAr.trim() || !nameEn.trim()) {
      setError(t('admin.plans.requiredFields'));
      return;
    }
    const priceCents = centsFromDollars(monthlyPrice);
    const yearlyPriceCents = centsFromDollars(yearlyPrice);
    if (priceCents <= 0 || yearlyPriceCents <= 0) {
      setError(t('admin.plans.invalidPrice'));
      return;
    }
    for (const feature of features) {
      if (feature.valueType !== 'LIMIT') continue;
      const state = values[feature.key];
      if (state?.mode === 'limited') {
        const n = Number(state.limit);
        if (!Number.isFinite(n) || n < 0) {
          setError(t('admin.plans.invalidLimit'));
          return;
        }
      }
    }

    setBusy(true);
    setError(null);
    try {
      const entitlements = features.map((feature) => {
        const state = values[feature.key];
        if (feature.valueType === 'BOOLEAN') {
          return { featureKey: feature.key, enabled: Boolean(state?.enabled), limitValue: null };
        }
        if (state?.mode === 'unlimited') {
          return { featureKey: feature.key, enabled: true, limitValue: -1, mode: 'unlimited' as const };
        }
        if (state?.mode === 'disabled') {
          return { featureKey: feature.key, enabled: false, limitValue: 0, mode: 'disabled' as const };
        }
        const limit = Math.floor(Number(state?.limit ?? 0));
        return { featureKey: feature.key, enabled: limit !== 0, limitValue: limit, mode: 'limited' as const };
      });
      const payload = {
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        name: nameEn.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        description: descriptionEn.trim() || undefined,
        descriptionAr: descriptionAr.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        priceCents,
        yearlyPriceCents,
        currency,
        trialDays: Number(trialDays) || 0,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        isRecommended,
        entitlements,
      };
      if (plan) await updateAdminPlan(plan.id, payload);
      else await createAdminPlan(payload);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!plan) return;
    if (!window.confirm(t('admin.plans.deleteConfirm').replace('{name}', plan.nameAr ?? plan.name))) return;
    setBusy(true);
    try {
      await deleteAdminPlan(plan.id);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function categoryLabel(key: string) {
    const map: Record<string, string> = {
      whatsapp: t('admin.plans.catWhatsapp'),
      tiktok: t('admin.plans.catTiktok'),
      whatsapp_api: t('admin.plans.catWhatsappApi'),
      social: t('admin.plans.catSocial'),
      ai: t('admin.plans.catAi'),
      team: t('admin.plans.catTeam'),
      other: t('admin.plans.catOther'),
    };
    return map[key] ?? key;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{plan ? t('admin.plans.editTitle') : t('admin.plans.createTitle')}</DialogTitle>
          <DialogDescription>{t('admin.plans.desc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.plans.general')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('admin.plans.slug')}</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={Boolean(plan)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.currency')}</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.nameAr')}</Label>
                  <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.nameEn')}</Label>
                  <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('admin.plans.descriptionAr')}</Label>
                  <Input value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('admin.plans.descriptionEn')}</Label>
                  <Input value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.monthlyPrice')}</Label>
                  <Input type="number" min={0} step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.yearlyPrice')}</Label>
                  <Input type="number" min={0} step="0.01" value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.trialDays')}</Label>
                  <Input type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.plans.sortOrder')}</Label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} id="plan-active" />
                  <Label htmlFor="plan-active">{t('admin.plans.active')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isRecommended} onCheckedChange={setIsRecommended} id="plan-recommended" />
                  <Label htmlFor="plan-recommended">{t('admin.plans.recommended')}</Label>
                </div>
              </div>
            </section>

            {grouped.map((group) => (
              <section key={group.key} className="space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoryLabel(group.key)}
                </h3>
                <div className="space-y-4">
                  {group.items.map((feature) => {
                    const state = values[feature.key] ?? { enabled: false, mode: 'disabled' as const, limit: '0' };
                    const label = locale === 'ar' ? feature.nameAr : feature.nameEn;
                    return (
                      <div key={feature.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{feature.key}</p>
                        </div>
                        {feature.valueType === 'BOOLEAN' ? (
                          <Switch
                            checked={state.enabled}
                            onCheckedChange={(checked) => setFeature(feature.key, { enabled: checked })}
                          />
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                              value={state.mode}
                              onChange={(e) => setFeature(feature.key, { mode: e.target.value as LimitMode, enabled: e.target.value !== 'disabled' })}
                            >
                              <option value="disabled">{t('admin.plans.modeDisabled')}</option>
                              <option value="limited">{t('admin.plans.modeLimited')}</option>
                              <option value="unlimited">{t('admin.plans.modeUnlimited')}</option>
                            </select>
                            {state.mode === 'limited' && (
                              <Input
                                className="w-24"
                                type="number"
                                min={0}
                                value={state.limit}
                                onChange={(e) => setFeature(feature.key, { limit: e.target.value })}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <aside className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.plans.preview')}</p>
            <h4 className="mt-2 text-lg font-semibold">{locale === 'ar' ? nameAr || '—' : nameEn || '—'}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{locale === 'ar' ? descriptionAr : descriptionEn}</p>
            <p className="mt-3 text-2xl font-bold">
              {formatPrice(centsFromDollars(monthlyPrice), currency)}
              <span className="text-sm font-normal text-muted-foreground"> / {t('billing.monthly')}</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {previewBullets.map((item) => (
                <li key={item.label} className={item.included ? '' : 'text-muted-foreground'}>
                  {item.included ? '✓' : '✕'} {item.label}
                  {item.detail ? ` (${item.detail})` : ''}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {plan ? (
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function planYearlyCents(plan: AdminPlanRow) {
  return plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8);
}

export function formatPlanPrice(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100);
}
