import { Injectable, Logger } from '@nestjs/common';
import { BaileysSocket } from './interfaces/session.interface';
import { BaileysCredentialStore } from './baileys-credential.store';

@Injectable()
export class BaileysProvider {
  private readonly logger = new Logger(BaileysProvider.name);

  constructor(private readonly credentials: BaileysCredentialStore) {}

  async createSocket(sessionId: string) {
    const baileys = await import('@whiskeysockets/baileys');
    const { state, saveCreds } = await this.credentials.state(sessionId, baileys as unknown as Record<string, unknown>);
    const { version } = await baileys.fetchLatestBaileysVersion();
    const socket = baileys.default({
      version,
      auth: state as never,
      printQRInTerminal: false,
      browser: ['Watsapp SaaS', 'Chrome', '1.0.0'],
      syncFullHistory: true,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    }) as unknown as BaileysSocket;

    return { socket, saveCreds, baileys };
  }

  async fetchProfilePhoto(socket: BaileysSocket, jid: string) {
    try {
      if (!socket.profilePictureUrl) return null;
      return (await socket.profilePictureUrl(jid)) ?? null;
    } catch (error) {
      this.logger.debug(`Profile photo unavailable for ${jid}: ${String(error)}`);
      return null;
    }
  }

  async downloadMedia(socket: BaileysSocket, message: unknown): Promise<Buffer | null> {
    try {
      const baileys = await import('@whiskeysockets/baileys');
      const buffer = await baileys.downloadMediaMessage(
        message as never,
        'buffer',
        {},
        {
          logger: this.logger as never,
          reuploadRequest: (socket as unknown as { updateMediaMessage?: (msg: unknown) => Promise<unknown> }).updateMediaMessage as never,
        },
      );
      return buffer as Buffer;
    } catch (error) {
      this.logger.warn(`Failed to download media: ${String(error)}`);
      return null;
    }
  }
}
