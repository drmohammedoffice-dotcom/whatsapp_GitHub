import { DisconnectReason } from '@whiskeysockets/baileys';
import { DisconnectInfo } from '../interfaces/session.interface';

export function parseDisconnectReason(error: unknown): DisconnectInfo {
  const boom = error as { output?: { statusCode?: number }; message?: string };
  const code = boom?.output?.statusCode;
  const message = boom?.message ?? (error instanceof Error ? error.message : 'Connection closed');
  const isLoggedOut = code === DisconnectReason.loggedOut;
  const shouldReconnect = !isLoggedOut && code !== DisconnectReason.loggedOut;

  let readable = message;
  if (code === DisconnectReason.loggedOut) readable = 'Logged Out';
  else if (code === DisconnectReason.connectionClosed) readable = 'Connection Lost';
  else if (code === DisconnectReason.restartRequired) readable = 'Restart Required';
  else if (code === DisconnectReason.timedOut) readable = 'Timeout';
  else if (code === DisconnectReason.connectionLost) readable = 'Network Error';

  return { code, message: readable, shouldReconnect, isLoggedOut };
}

export function toWhatsAppJid(value: string) {
  if (value.includes('@')) return value;
  return `${value.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

export function phoneFromJid(jid?: string | null) {
  if (!jid) return null;
  return jid.split(':')[0]?.split('@')[0] ?? null;
}

export function reconnectDelayMs(attempt: number) {
  return Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5));
}
