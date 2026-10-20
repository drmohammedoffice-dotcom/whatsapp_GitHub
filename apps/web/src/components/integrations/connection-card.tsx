'use client';

import Image from 'next/image';
import { RefreshCw, Unplug } from 'lucide-react';
import { ConnectionHealth, ConnectionStatusBadge } from '@/components/integrations/connection-status-badge';
import { MetaOAuthConnect } from '@/components/integrations/meta-oauth-connect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/utils';

export type ConnectionRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  health: ConnectionHealth;
  metadata?: {
    pageId?: string;
    botUsername?: string;
    instagramUsername?: string;
    profilePictureUrl?: string;
    webhookVerified?: boolean;
  };
};

type ConnectionCardProps = {
  title: string;
  description: string;
  connections: ConnectionRow[];
  onRefresh: () => void;
  onDisconnect: (channelId: string) => Promise<void>;
  connectSlot: React.ReactNode;
  busy?: boolean;
  extraActions?: React.ReactNode;
};

export function ConnectionCard({
  title,
  description,
  connections,
  onRefresh,
  onDisconnect,
  connectSlot,
  busy,
  extraActions,
}: ConnectionCardProps) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.length === 0 ? (
          connectSlot
        ) : (
          <>
            <ScrollArea className={connections.length > 6 ? 'max-h-[32rem]' : undefined}>
              <div className="space-y-4 pe-2">
                {connections.map((row) => (
                  <div key={row.id} className="flex gap-4 rounded-xl border bg-muted/20 p-4">
                    {row.metadata?.profilePictureUrl ? (
                      <Image
                        src={row.metadata.profilePictureUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                        {row.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.name}</p>
                        <ConnectionStatusBadge health={row.health} />
                      </div>
                      {row.metadata?.instagramUsername && (
                        <p className="text-sm text-muted-foreground">@{row.metadata.instagramUsername}</p>
                      )}
                      {row.metadata?.botUsername && (
                        <p className="text-sm text-muted-foreground">@{row.metadata.botUsername}</p>
                      )}
                      {row.metadata?.webhookVerified !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Webhook: {row.metadata.webhookVerified ? 'verified' : 'pending'}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(row.health === 'expired' || row.health === 'reconnect_required') &&
                          (row.provider === 'META_MESSENGER' || row.provider === 'META_INSTAGRAM') && (
                            <MetaOAuthConnect
                              label="Reconnect"
                              target={row.provider === 'META_INSTAGRAM' ? 'instagram' : 'messenger'}
                            />
                          )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRefresh()}
                        >
                          <RefreshCw className="me-1 h-3.5 w-3.5" />
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => onDisconnect(row.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Unplug className="me-1 h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {extraActions ? <div className="flex flex-wrap gap-2">{extraActions}</div> : null}
            <div className="border-t pt-4">{connectSlot}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export async function refreshTelegramWebhook(channelId: string) {
  return api(`/telegram/${channelId}/webhook-status`);
}
