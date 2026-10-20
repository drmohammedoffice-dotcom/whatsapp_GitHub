'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IntegrationHubCard } from '@/components/integrations/hub/integration-hub-card';
import { startMetaOAuth } from '@/components/integrations/meta-oauth-connect';
import { InstagramLoginConnect } from '@/components/integrations/instagram-login-connect';
import { TelegramUserConnect } from '@/components/integrations/telegram-user-connect';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  connectIntegration,
  disconnectIntegration,
  fetchIntegrationsHub,
  formatRelativeTime,
  reconnectIntegration,
  type IntegrationConnectResponse,
  type IntegrationProvider,
  type IntegrationProviderSummary,
  type IntegrationsHubResponse,
} from '@/lib/integrations-hub';
import { parseApiError } from '@/lib/utils';

function IntegrationsHubInner() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hub, setHub] = useState<IntegrationsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [telegramPanel, setTelegramPanel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHub(await fetchIntegrationsHub());
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
    if (searchParams.get('connected') === '1' || searchParams.get('connected') === 'true') {
      setNotice(t('integrationsHub.connectedSuccess'));
    }
    const callbackError = searchParams.get('error');
    if (callbackError) setError(decodeURIComponent(callbackError));
  }, [load, searchParams, t]);

  const providers = useMemo(() => {
    const order: IntegrationProvider[] = [
      'facebook-messenger',
      'instagram',
      'whatsapp',
      'tiktok',
      'telegram',
    ];
    if (!hub) return [];
    return order
      .map((p) => hub.providers.find((x) => x.provider === p))
      .filter(Boolean) as IntegrationProviderSummary[];
  }, [hub]);

  async function handleConnect(provider: IntegrationProvider) {
    console.info('[Integrations Hub] Connect clicked', { provider });
    setBusyProvider(provider);
    setError(null);
    let redirecting = false;
    try {
      if (provider === 'telegram') {
        setTelegramPanel(true);
        return;
      }

      // Meta: call POST /api/auth/meta/login directly (not the hub proxy)
      if (provider === 'facebook-messenger' || provider === 'instagram') {
        const authUrl = await startMetaOAuth();
        redirecting = true;
        window.location.assign(authUrl);
        return;
      }

      const result = await connectIntegration(provider);
      console.info('[Integrations Hub] connect response', result);

      const redirectUrl =
        result.url ??
        (result as IntegrationConnectResponse & { authUrl?: string }).authUrl;

      if (redirectUrl) {
        console.info('[Integrations Hub] Redirect started', redirectUrl);
        redirecting = true;
        window.location.assign(redirectUrl);
        return;
      }

      if (result.action === 'navigate' && result.url) {
        router.push(result.url);
        return;
      }
      if (result.action === 'inline') {
        setTelegramPanel(true);
        return;
      }

      console.error('[Integrations Hub] connect returned no redirect URL', result);
      setError(t('integrationsHub.connectFailed'));
      await load();
    } catch (err) {
      const message = parseApiError(err);
      console.error('[Integrations Hub] connect error', message, err);
      setError(message);
    } finally {
      if (!redirecting) setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: IntegrationProvider, accountId: string) {
    setBusyProvider(provider);
    setError(null);
    try {
      let body: Record<string, unknown> = { channelId: accountId };

      if (provider === 'whatsapp') {
        const wa = hub?.providers.find((p) => p.provider === 'whatsapp');
        const account = wa?.accounts.find((a) => a.id === accountId);
        const meta = account?.metadata as { accountType?: string } | undefined;
        body =
          meta?.accountType === 'cloud_api'
            ? { cloudAccountId: accountId }
            : { sessionId: accountId };
      } else if (provider === 'telegram') {
        const tg = hub?.providers.find((p) => p.provider === 'telegram');
        const account = tg?.accounts.find((a) => a.id === accountId);
        body = { channelId: accountId };
        const meta = account?.metadata as { type?: string; connectionId?: string; channelId?: string } | undefined;
        if (meta?.type === 'personal') {
          body = {
            channelId: String(meta.channelId ?? accountId),
            ...(meta.connectionId ? { connectionId: meta.connectionId } : {}),
          };
        }
      } else if (provider === 'tiktok') {
        body = {};
      }

      await disconnectIntegration(provider, body);
      setNotice(t('integrationsHub.disconnectedSuccess'));
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleReconnect(provider: IntegrationProvider, accountId: string) {
    setBusyProvider(provider);
    setError(null);
    try {
      const result = await reconnectIntegration(
        provider,
        provider === 'whatsapp'
          ? (() => {
              const wa = hub?.providers.find((p) => p.provider === 'whatsapp');
              const account = wa?.accounts.find((a) => a.id === accountId);
              const meta = account?.metadata as { accountType?: string } | undefined;
              return meta?.accountType === 'cloud_api'
                ? { cloudAccountId: accountId }
                : { sessionId: accountId };
            })()
          : {},
      );
      if (result.action === 'redirect' && result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.action === 'navigate' && result.url) {
        router.push(result.url);
        return;
      }
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyProvider(null);
    }
  }

  function statusLabel(status: IntegrationProviderSummary['status']) {
    return t(`integrationsHub.status.${status}` as never);
  }

  function healthLabel(health: IntegrationProviderSummary['health']) {
    return t(`integrationsHub.health.${health}` as never);
  }

  function connectLabel(provider: IntegrationProvider) {
    const keys: Record<IntegrationProvider, string> = {
      'facebook-messenger': 'integrationsHub.connectFacebook',
      instagram: 'integrationsHub.connectInstagram',
      whatsapp: 'integrationsHub.connectWhatsApp',
      tiktok: 'integrationsHub.connectTikTok',
      telegram: 'integrationsHub.connectTelegram',
    };
    return t(keys[provider] as never);
  }

  async function handleDisconnectAll(provider: IntegrationProvider) {
    const summary = hub?.providers.find((p) => p.provider === provider);
    if (!summary?.accounts.length) return;
    setBusyProvider(provider);
    setError(null);
    try {
      for (const account of summary.accounts) {
        if (provider === 'whatsapp') {
          const meta = account.metadata as { accountType?: string } | undefined;
          await disconnectIntegration(
            provider,
            meta?.accountType === 'cloud_api'
              ? { cloudAccountId: account.id }
              : { sessionId: account.id },
          );
        } else {
          await disconnectIntegration(provider, { channelId: account.id });
        }
      }
      setNotice(t('integrationsHub.disconnectedAllSuccess'));
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyProvider(null);
    }
  }

  function manageHref(provider: IntegrationProvider) {
    const map: Partial<Record<IntegrationProvider, string>> = {
      'facebook-messenger': '/messenger',
      instagram: '/instagram',
      whatsapp: '/whatsapp',
      tiktok: '/tiktok',
      telegram: '/telegram',
    };
    return map[provider];
  }

  return (
    <AppShell>
      <PageHeader
        title={t('integrationsHub.title')}
        description={t('integrationsHub.description')}
        actions={(
          <Button variant="outline" asChild>
            <Link href="/inbox/social">{t('integrations.unifiedInbox')}</Link>
          </Button>
        )}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 space-y-3"
      >
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <AlertBanner variant="success" message={notice} onDismiss={() => setNotice(null)} />}
      </motion.div>

      <div className="mt-6 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 via-transparent to-transparent p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{t('integrationsHub.heroTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('integrationsHub.heroDesc')}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingBlock className="mt-8" />
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {providers.map((provider, index) => (
            <motion.div
              key={provider.provider}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.4 }}
            >
              <IntegrationHubCard
                provider={provider}
                lastSyncDisplay={formatRelativeTime(provider.lastSyncAt, locale)}
                statusLabel={statusLabel(provider.status)}
                healthLabel={t('integrationsHub.healthLabel')}
                healthStatusLabel={healthLabel(provider.health)}
                lastSyncLabel={t('integrationsHub.lastSync')}
                connectedAccountLabel={t('integrationsHub.connectedAccount')}
                connectLabel={connectLabel(provider.provider)}
                disconnectLabel={t('integrationsHub.disconnect')}
                disconnectAllLabel={t('integrationsHub.disconnectAll')}
                showAllLabel={t('integrationsHub.showAllAccounts')}
                showLessLabel={t('integrationsHub.showLessAccounts')}
                accountsCountLabel={t('integrationsHub.accountsConnected')}
                reconnectLabel={t('integrationsHub.reconnect')}
                manageLabel={t('integrationsHub.manage')}
                addNumberLabel={
                  provider.provider === 'whatsapp' ? t('integrationsHub.addNumber') : undefined
                }
                busy={busyProvider === provider.provider}
                onConnect={() => handleConnect(provider.provider).catch(console.error)}
                onDisconnect={(id) => handleDisconnect(provider.provider, id).catch(console.error)}
                onDisconnectAll={
                  provider.provider === 'facebook-messenger' || provider.provider === 'instagram'
                    ? () => handleDisconnectAll(provider.provider).catch(console.error)
                    : undefined
                }
                onReconnect={(id) => handleReconnect(provider.provider, id).catch(console.error)}
                onManage={
                  manageHref(provider.provider)
                    ? () => router.push(manageHref(provider.provider)!)
                    : undefined
                }
                hideConnectButton={provider.provider === 'telegram' && telegramPanel}
              >
                {provider.provider === 'telegram' && telegramPanel && (
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-medium">{t('integrationsHub.telegramPersonalTitle')}</p>
                    <TelegramUserConnect
                      onConnected={() => {
                        setTelegramPanel(false);
                        setNotice(t('integrationsHub.connectedSuccess'));
                        load().catch(console.error);
                      }}
                      onError={setError}
                    />
                  </div>
                )}
              </IntegrationHubCard>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-8 max-w-xl">
          <InstagramLoginConnect
            onSuccess={() => {
              setNotice('تم ربط إنستغرام واشتراك Webhook بنجاح');
              void load();
            }}
            onError={setError}
          />
        </div>
      )}
    </AppShell>
  );
}

export default function SettingsIntegrationsHubPage() {
  return (
    <Suspense fallback={<LoadingBlock className="mt-6" />}>
      <IntegrationsHubInner />
    </Suspense>
  );
}
