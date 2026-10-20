'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Loader2, Plug, RefreshCw, Settings2, Unplug } from 'lucide-react';
import { ProviderLogo } from '@/components/integrations/hub/provider-logo';
import {
  IntegrationHealthBadge,
  IntegrationStatusBadge,
} from '@/components/integrations/hub/integration-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { IntegrationProviderSummary } from '@/lib/integrations-hub';

const DEFAULT_VISIBLE_ACCOUNTS = 6;

type IntegrationHubCardProps = {
  provider: IntegrationProviderSummary;
  statusLabel: string;
  healthLabel: string;
  lastSyncLabel: string;
  connectedAccountLabel: string;
  connectLabel: string;
  disconnectLabel: string;
  disconnectAllLabel?: string;
  reconnectLabel: string;
  manageLabel: string;
  showAllLabel?: string;
  showLessLabel?: string;
  accountsCountLabel?: string;
  addNumberLabel?: string;
  lastSyncDisplay?: string;
  healthStatusLabel: string;
  busy?: boolean;
  onConnect: () => void;
  onDisconnect?: (accountId: string) => void;
  onDisconnectAll?: () => void;
  onReconnect?: (accountId: string) => void;
  onManage?: () => void;
  children?: React.ReactNode;
  hideConnectButton?: boolean;
};

export function IntegrationHubCard({
  provider,
  statusLabel,
  healthLabel,
  lastSyncLabel,
  connectedAccountLabel,
  connectLabel,
  disconnectLabel,
  disconnectAllLabel,
  reconnectLabel,
  manageLabel,
  showAllLabel,
  showLessLabel,
  accountsCountLabel,
  addNumberLabel,
  lastSyncDisplay,
  healthStatusLabel,
  busy,
  onConnect,
  onDisconnect,
  onDisconnectAll,
  onReconnect,
  onManage,
  children,
  hideConnectButton,
}: IntegrationHubCardProps) {
  const [expanded, setExpanded] = useState(false);
  const showAccounts = provider.accounts.length > 0;
  const hasHiddenAccounts = provider.accounts.length > DEFAULT_VISIBLE_ACCOUNTS;
  const visibleAccounts = expanded || !hasHiddenAccounts
    ? provider.accounts
    : provider.accounts.slice(0, DEFAULT_VISIBLE_ACCOUNTS);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Card className="group overflow-hidden border border-border/60 bg-card/80 shadow-card backdrop-blur-sm transition-shadow hover:shadow-lg dark:bg-card/60">
        <CardContent className="p-0">
          <div className="border-b border-border/50 bg-gradient-to-br from-muted/30 via-transparent to-transparent p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <ProviderLogo provider={provider.provider} size="lg" />
                <div className="min-w-0 space-y-1">
                  <h3 className="text-lg font-semibold tracking-tight">{provider.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{provider.description}</p>
                </div>
              </div>
              <IntegrationStatusBadge status={provider.status} label={statusLabel} />
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricBlock
                label={connectedAccountLabel}
                value={
                  provider.accountCount > 1
                    ? `${provider.accountCount}${accountsCountLabel ? ` ${accountsCountLabel}` : ''}`
                    : provider.connectedAccount ?? '—'
                }
              />
              <MetricBlock
                label={lastSyncLabel}
                value={lastSyncDisplay ?? (provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleString() : '—')}
              />
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{healthLabel}</p>
                <IntegrationHealthBadge health={provider.health} label={healthStatusLabel} />
              </div>
            </div>

            {showAccounts && (
              <div className="space-y-2">
                <ScrollArea className={expanded || provider.accounts.length > 8 ? 'max-h-80' : undefined}>
                  <div className="space-y-2 pe-2">
                    {visibleAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {account.avatarUrl ? (
                            <Image
                              src={account.avatarUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {account.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{account.name}</p>
                            {account.subtitle && (
                              <p className="truncate text-xs text-muted-foreground">{account.subtitle}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {(account.status === 'expired' || account.status === 'reconnect_required') && onReconnect && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => onReconnect(account.id)}
                              className="gap-1.5"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {reconnectLabel}
                            </Button>
                          )}
                          {onDisconnect && account.status !== 'disconnected' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => onDisconnect(account.id)}
                              className="gap-1.5 text-destructive hover:text-destructive"
                            >
                              <Unplug className="h-3.5 w-3.5" />
                              {disconnectLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {hasHiddenAccounts && showAllLabel && showLessLabel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded
                      ? showLessLabel
                      : `${showAllLabel} (${provider.accounts.length})`}
                  </Button>
                )}
              </div>
            )}

            {children}

            <div className="flex flex-wrap gap-2 pt-1">
              {!hideConnectButton && (!provider.connected || provider.capabilities.multiAccount) ? (
                <Button type="button" disabled={busy} onClick={onConnect} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  {provider.connected && addNumberLabel ? addNumberLabel : connectLabel}
                </Button>
              ) : null}
              {onManage && provider.connected && (
                <Button variant="outline" disabled={busy} onClick={onManage} className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  {manageLabel}
                </Button>
              )}
              {onDisconnectAll && provider.connected && provider.accounts.length > 1 && disconnectAllLabel && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={onDisconnectAll}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Unplug className="h-4 w-4" />
                  {disconnectAllLabel}
                </Button>
              )}
              {onDisconnect && provider.connected && provider.accounts.length === 1 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => onDisconnect(provider.accounts[0]!.id)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Unplug className="h-4 w-4" />
                  {disconnectLabel}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm font-medium', value === '—' && 'text-muted-foreground')}>{value}</p>
    </div>
  );
}
