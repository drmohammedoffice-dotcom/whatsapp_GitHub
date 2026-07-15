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
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [optimizationEvent, setOptimizationEvent] = useState<TikTokOptimizationEvent>('Lead');
  const [customEventName, setCustomEventName] = useState('');
  const [enabledEvents, setEnabledEvents] = useState<Set<TikTokOptimizationEvent>>(new Set(['Lead']));

  useEffect(() => {
    if (!integration || !open) return;
    setName(integration.name ?? integration.pixelName ?? '');
    setWhatsappNumber(integration.whatsappNumber ?? '');
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
        whatsappNumber,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('tiktokIntegration.editPixel')}</DialogTitle>
          <DialogDescription>{t('tiktokIntegration.editPixelDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.pixelDisplayName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('tiktokIntegration.whatsappNumber')}</Label>
            <Input
              inputMode="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={busy || whatsappNumber.length < 8}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
