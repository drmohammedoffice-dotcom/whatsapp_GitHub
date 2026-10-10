import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export type ManagedTelegramClient = {
  connectionId: string;
  client: TelegramClient;
};

@Injectable()
export class TelegramClientManager implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramClientManager.name);
  private readonly clients = new Map<string, TelegramClient>();
  private readonly peerHints = new Map<string, { accessHash: string; username?: string }>();
  readonly apiId: number;
  readonly apiHash: string;

  constructor(config: ConfigService) {
    this.apiId = Number(config.get<string>('TELEGRAM_API_ID', '0'));
    this.apiHash = config.get<string>('TELEGRAM_API_HASH', '');
  }

  isConfigured() {
    return this.apiId > 0 && Boolean(this.apiHash);
  }

  async createClient(sessionString = ''): Promise<TelegramClient> {
    if (!this.isConfigured()) {
      throw new Error('Telegram MTProto is not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH.');
    }
    const client = new TelegramClient(new StringSession(sessionString), this.apiId, this.apiHash, {
      connectionRetries: 5,
      autoReconnect: true,
    });
    await client.connect();
    return client;
  }

  getClient(connectionId: string): TelegramClient | undefined {
    return this.clients.get(connectionId);
  }

  setClient(connectionId: string, client: TelegramClient) {
    this.clients.set(connectionId, client);
  }

  async removeClient(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        this.logger.warn(`Disconnect failed for ${connectionId}: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.clients.delete(connectionId);
    }
    this.clearPeerCache(connectionId);
  }

  saveSessionString(client: TelegramClient): string {
    return (client.session as StringSession).save();
  }

  cachePeer(connectionId: string, peerId: string, accessHash: string, username?: string) {
    this.peerHints.set(`${connectionId}:${peerId}`, { accessHash, username });
  }

  getCachedPeer(connectionId: string, peerId: string) {
    return this.peerHints.get(`${connectionId}:${peerId}`);
  }

  clearPeerCache(connectionId: string) {
    for (const key of [...this.peerHints.keys()]) {
      if (key.startsWith(`${connectionId}:`)) this.peerHints.delete(key);
    }
  }

  async onModuleDestroy() {
    for (const connectionId of [...this.clients.keys()]) {
      await this.removeClient(connectionId);
    }
  }
}
