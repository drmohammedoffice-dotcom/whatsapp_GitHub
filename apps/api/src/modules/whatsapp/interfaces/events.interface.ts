import { WhatsAppConnectionLogEvent } from '@watsapp/database';

export interface ConnectionLogInput {
  teamId: string;
  sessionId: string;
  event: WhatsAppConnectionLogEvent;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface IncomingMessagePayload {
  sessionId: string;
  messageId: string;
  chatId: string;
  fromJid: string;
  text?: string | null;
  type: string;
  receivedAt: string;
}
