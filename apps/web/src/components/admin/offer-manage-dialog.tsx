'use client';

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminOffer,
  deleteAdminOffer,
  updateAdminOffer,
  type AdminOfferRow,
} from '@/lib/admin-api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: AdminOfferRow | null;
  onSaved: () => void;
};

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OfferManageDialog({ open, onOpenChange, offer, onSaved }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [badgeTextAr, setBadgeTextAr] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaLabelAr, setCtaLabelAr] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(offer?.title ?? '');
    setTitleAr(offer?.titleAr ?? '');
    setDescription(offer?.description ?? '');
    setDescriptionAr(offer?.descriptionAr ?? '');
    setBadgeText(offer?.badgeText ?? '');
    setBadgeTextAr(offer?.badgeTextAr ?? '');
    setCtaLabel(offer?.ctaLabel ?? '');
    setCtaLabelAr(offer?.ctaLabelAr ?? '');
    setCtaUrl(offer?.ctaUrl ?? '');
    setSortOrder(String(offer?.sortOrder ?? 0));
    setStartsAt(toLocalInput(offer?.startsAt));
    setEndsAt(toLocalInput(offer?.endsAt));
    setIsActive(offer?.isActive ?? true);
    setError(null);
  }, [open, offer]);

  async function save() {
    if (!title.trim()) {
      setError(t('admin.offers.requiredTitle'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        titleAr: titleAr.trim() || undefined,
        description: description.trim() || undefined,
        descriptionAr: descriptionAr.trim() || undefined,
        badgeText: badgeText.trim() || undefined,
        badgeTextAr: badgeTextAr.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaLabelAr: ctaLabelAr.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      };
      if (offer) await updateAdminOffer(offer.id, payload);
      else await createAdminOffer(payload);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!offer) return;
    if (!window.confirm(t('admin.offers.deleteConfirm').replace('{title}', offer.title))) return;
    setBusy(true);
    try {
      await deleteAdminOffer(offer.id);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{offer ? t('admin.offers.editTitle') : t('admin.offers.createTitle')}</DialogTitle>
          <DialogDescription>{t('admin.offers.desc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('admin.offers.titleEn')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.titleAr')}</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('admin.offers.descriptionEn')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('admin.offers.descriptionAr')}</Label>
            <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={3} dir="rtl" />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.badgeEn')}</Label>
            <Input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="20% OFF" />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.badgeAr')}</Label>
            <Input value={badgeTextAr} onChange={(e) => setBadgeTextAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.ctaEn')}</Label>
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.ctaAr')}</Label>
            <Input value={ctaLabelAr} onChange={(e) => setCtaLabelAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('admin.offers.ctaUrl')}</Label>
            <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/register" />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.sortOrder')}</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="offer-active" />
            <Label htmlFor="offer-active">{t('admin.offers.active')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.startsAt')}</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.offers.endsAt')}</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          {offer ? (
            <Button type="button" variant="destructive" onClick={() => void remove()} disabled={busy}>
              {t('admin.offers.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
