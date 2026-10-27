'use client';

import { SOCKET_EVENTS } from '@watsapp/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Bell, Link2, MessageCircle, Share2, UserRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, cn, parseApiError } from '@/lib/utils';
import { createSocket } from '@/lib/socket';

type Webhook = { id: string; url: string; events: string[]; enabled: boolean };
type Notification = { id: string; title: string; body: string; readAt?: string };

type ChannelRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  connected: boolean;
  whatsAppCloudAccountId?: string | null;
};

export default function SettingsPage() {
  const { t, dir, locale } = useTranslation();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    const [webhookData, notificationData, channelData] = await Promise.all([
      api<Webhook[]>('/webhooks'),
      api<Notification[]>('/notifications'),
      api<ChannelRow[]>('/channels'),
    ]);
    setWebhooks(webhookData);
    setNotifications(notificationData);
    setChannels(channelData);
  }

  useEffect(() => {
    load().catch((err) => setError(parseApiError(err)));
    const socket = createSocket();
    socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, () => load().catch(console.error));
    return () => { socket.disconnect(); };
  }, []);

  async function runForm(fn: () => Promise<void>) {
    setError(null);
    setSuccess(null);
    try {
      await fn();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runForm(async () => {
      await api('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: form.get('url'),
          events: ['INCOMING_MESSAGE', 'CONVERSATION_MESSAGE_CREATED', 'CONVERSATION_ASSIGNED', 'CONTACT_UPDATED'],
        }),
      });
      event.currentTarget.reset();
      await load();
      setSuccess(t('settings.webhookCreated'));
    });
  }

  return (
    <AppShell>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />

      <div className="mt-4 space-y-3">
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {success && <AlertBanner variant="success" message={success} onDismiss={() => setSuccess(null)} />}
      </div>

      <Card className="mt-6 border-primary/20 bg-primary/5 shadow-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{t('settings.whatsAppCardTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.whatsAppCardDesc')}</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/whatsapp">
              {t('settings.goToWhatsApp')} <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black text-white">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{t('settings.integrationsLink')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.integrationsLinkDesc')}</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings/integrations">
              {t('settings.integrationsLink')} <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4 border-0 shadow-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{t('nav.account')}</p>
              <p className="text-sm text-muted-foreground">
                {locale === 'ar'
                  ? 'الملف الشخصي، كلمة المرور، وحذف الحساب.'
                  : 'Profile, password and account deletion.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/account">
                {t('nav.account')} <ArrowRight className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
              </Link>
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" asChild>
              <Link href="/account#delete-account">{locale === 'ar' ? 'حذف الحساب' : 'Delete account'}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="channels" className="mt-6">
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="channels"><MessageCircle className="me-2 h-4 w-4" />{t('settings.tabChannels')}</TabsTrigger>
          <TabsTrigger value="webhooks"><Link2 className="me-2 h-4 w-4" />{t('settings.tabWebhooks')}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="me-2 h-4 w-4" />{t('settings.tabNotifications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('settings.channelsTitle')}</CardTitle>
              <CardDescription>{t('settings.channelsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('settings.channelsList')}</p>
                {channels.filter((c) => c.provider === 'WHATSAPP_CLOUD').length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : channels.filter((c) => c.provider === 'WHATSAPP_CLOUD').map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">{channel.provider} · {channel.status}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runForm(async () => {
                        const accountId = channel.whatsAppCloudAccountId;
                        if (!accountId) throw new Error('WhatsApp Cloud account id missing');
                        await api(`/whatsapp-cloud/accounts/${accountId}/disconnect`, {
                          method: 'POST',
                          body: '{}',
                        });
                        await load();
                      })}
                    >
                      {t('settings.disconnectChannel')}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('settings.webhooksTitle')}</CardTitle>
              <CardDescription>{t('settings.webhooksDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={createWebhook} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="webhookUrl">{t('settings.webhookUrl')}</Label>
                  <Input id="webhookUrl" name="url" type="url" placeholder="https://example.com/webhook" required />
                </div>
                <Button type="submit">{t('settings.createWebhook')}</Button>
              </form>
              <div className="space-y-3">
                {webhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No webhooks configured.</p>
                ) : webhooks.map((hook) => (
                  <div key={hook.id} className="rounded-lg border p-4">
                    <p className="font-medium break-all">{hook.url}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{hook.events.join(' · ')}</p>
                    <Badge variant={hook.enabled ? 'success' : 'secondary'} className="mt-2">{hook.enabled ? t('common.enabled') : t('common.disabled')}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>{t('settings.notificationsTitle')}</CardTitle>
              <CardDescription>{t('settings.notificationsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg border p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
