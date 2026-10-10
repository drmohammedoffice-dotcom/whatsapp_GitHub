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
import {
  OPTIMIZATION_EVENT_OPTIONS,
  updateTikTokIntegration,
  type TikTokIntegrationView,
  type TikTokOptimizationEvent,
} from '@/lib/tiktok-integration';
import { parseApiError } from '@/lib/utils';

type Props = {
  integration: TikTokIntegrationView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function PixelEditDialog({ integration, open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [destinationType, setDestinationType] = useState<'WHATSAPP_NUMBER' | 'EXTERNAL_URL'>('WHATSAPP_NUMBER');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [externalRedirectUrl, setExternalRedirectUrl] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [optimizationEvent, setOptimizationEvent] = useState<TikTokOptimizationEvent>('Lead');
  const [customEventName, setCustomEventName] = useState('');
  const [enabledEvents, setEnabledEvents] = useState<Set<TikTokOptimizationEvent>>(new Set(['Lead', 'Contact']));

  useEffect(() => {
    if (!integration || !open) return;
    setName(integration.name ?? integration.pixelName ?? '');
    const raw = integration.destinationType;
    const dest = raw === 'WHATSAPP_NUMBER' || raw === 'EXTERNAL_URL' || raw === 'INSTANT_FORM' || raw === 'STORE'
      ? raw
      : 'EXTERNAL_URL';
    setDestinationType(dest === 'INSTANT_FORM' || dest === 'STORE' ? 'EXTERNAL_URL' : dest);
    setWhatsappNumber(integration.whatsappNumber ?? '');
    setExternalRedirectUrl(integration.externalRedirectUrl ?? '');
    setRedirectMessage(integration.redirectMessage ?? '');
    setOptimizationEvent(integration.defaultOptimizationEvent);
    setCustomEventName(integration.customEventName ?? '');
    const enabled = new Set(
      integration.eventConfigurations.filter((e) => e.enabled).map((e) => e.eventName),
    );
    if (enabled.size === 0) enabled.add(integration.defaultOptimizationEvent);
    setEnabledEvents(enabled);
    setError(null);
  }, [integration, open]);

  function toggleEvent(event: TikTokOptimizationEvent) {
    if (event === optimizationEvent) return;
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  async function save() {
    if (!integration) return;
    setBusy(true);
    setError(null);
    try {
      await updateTikTokIntegration(integration.id, {
        name: name.trim() || undefined,
        destinationType,
        whatsappNumber: destinationType === 'WHATSAPP_NUMBER' ? whatsappNumber : undefined,
        externalRedirectUrl: destinationType === 'EXTERNAL_URL' ? externalRedirectUrl.trim() : undefined,
        defaultOptimizationEvent: optimizationEvent,
        customEventName: optimizationEvent === 'Custom' ? customEventName : undefined,
        enabledEvents: Array.from(enabledEvents),
        redirectMessage: redirectMessage.trim() || undefined,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,880px)] w-[min(100vw-1.25rem,42rem)] max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-5 sm:px-6">
          <DialogTitle>{t('tiktokIntegration.editPixel')}</DialogTitle>
          <DialogDescription>{t('tiktokIntegration.editPixelDesc')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-2 sm:px-6">
          {integration && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              نوع البكسل:{' '}
              <span className="font-medium text-foreground">
                {integration.destinationType === 'STORE'
                  ? 'متجر إلكتروني'
                  : integration.destinationType === 'INSTANT_FORM'
                    ? 'استمارة فورية'
                    : integration.destinationType === 'WHATSAPP_NUMBER'
                      ? 'واتساب'
                      : 'رابط خارجي'}
              </span>
              {integration.destinationType === 'STORE' || integration.destinationType === 'INSTANT_FORM'
                ? ' — التحويل يُرسل تلقائياً عند أول طلب'
                : null}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.pixelDisplayName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.redirectDestination')}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value as 'WHATSAPP_NUMBER' | 'EXTERNAL_URL')}
            >
              <option value="WHATSAPP_NUMBER">{t('tiktokIntegration.destinationPhone')}</option>
              <option value="EXTERNAL_URL">{t('tiktokIntegration.destinationExternal')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>
              {destinationType === 'WHATSAPP_NUMBER'
                ? t('tiktokIntegration.whatsappNumber')
                : t('tiktokIntegration.externalRedirectUrl')}
            </Label>
            <Input
              inputMode={destinationType === 'WHATSAPP_NUMBER' ? 'tel' : 'url'}
              placeholder={destinationType === 'EXTERNAL_URL' ? 'https://chat.whatsapp.com/...' : undefined}
              value={destinationType === 'WHATSAPP_NUMBER' ? whatsappNumber : externalRedirectUrl}
              onChange={(e) =>
                destinationType === 'WHATSAPP_NUMBER'
                  ? setWhatsappNumber(e.target.value)
                  : setExternalRedirectUrl(e.target.value)
              }
              dir={destinationType === 'EXTERNAL_URL' ? 'ltr' : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.redirectMessage')}</Label>
            <Input value={redirectMessage} onChange={(e) => setRedirectMessage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.optimizationEvent')}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={optimizationEvent}
              onChange={(e) => {
                const ev = e.target.value as TikTokOptimizationEvent;
                setOptimizationEvent(ev);
                setEnabledEvents((prev) => new Set([...prev, ev]));
              }}
            >
              {OPTIMIZATION_EVENT_OPTIONS.map((event) => (
                <option key={event} value={event}>
                  {t(`tiktokIntegration.events.${event}`)}
                </option>
              ))}
            </select>
          </div>
          {optimizationEvent === 'Custom' && (
            <div className="space-y-2">
              <Label>{t('tiktokIntegration.customEventName')}</Label>
              <Input value={customEventName} onChange={(e) => setCustomEventName(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.enabledEvents')}</Label>
            <div className="flex flex-wrap gap-2">
              {OPTIMIZATION_EVENT_OPTIONS.filter((e) => e !== 'PageView').map((event) => (
                <label key={event} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={enabledEvents.has(event)}
                    disabled={event === optimizationEvent}
                    onChange={() => toggleEvent(event)}
                  />
                  {t(`tiktokIntegration.events.${event}`)}
                </label>
              ))}
            </div>
          </div>
          {integration?.trackingUrl && (
            <p className="text-xs text-muted-foreground">
              {t('tiktokIntegration.trackingUrl')}: <code>{integration.trackingUrl}</code>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t px-5 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={
              busy ||
              (destinationType === 'WHATSAPP_NUMBER'
                ? whatsappNumber.replace(/\D/g, '').length < 8
                : !/^https?:\/\/\S+$/i.test(externalRedirectUrl.trim()))
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
