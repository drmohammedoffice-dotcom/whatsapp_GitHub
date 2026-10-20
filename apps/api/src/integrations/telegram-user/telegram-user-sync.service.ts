import { Injectable, Logger } from '@nestjs/common';
import { TelegramConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { TELEGRAM_SYNC_DIALOG_LIMIT, TELEGRAM_SYNC_MESSAGE_LIMIT } from './telegram-user.constants';
import { TelegramClientManager } from './telegram-client.manager';
import { TelegramUserEventsService } from './telegram-user-events.service';

@Injectable()
export class TelegramUserSyncService {
  private readonly logger = new Logger(TelegramUserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: TelegramClientManager,
    private readonly events: TelegramUserEventsService,
  ) {}

  async syncConnection(connectionId: string) {
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { id: connectionId },
      include: { channel: true },
    });
    if (!connection?.channel || connection.status !== TelegramConnectionStatus.CONNECTED) {
      return { synced: 0 };
    }

    const client = this.clients.getClient(connectionId);
    if (!client) return { synced: 0 };

    let count = 0;
    const dialogs = await client.getDialogs({ limit: TELEGRAM_SYNC_DIALOG_LIMIT });
    for (const dialog of dialogs) {
      if (!dialog.entity) continue;
      const messages = await client.getMessages(dialog.entity, { limit: TELEGRAM_SYNC_MESSAGE_LIMIT });
      for (const message of [...messages].reverse()) {
        await this.events.ingestMessage(client, connection.teamId, connection.channel.id, connectionId, message, true);
        count += 1;
      }
    }

    await this.prisma.telegramConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    this.logger.log(`Synced ${count} messages for Telegram connection ${connectionId}`);
    return { synced: count };
  }
}
