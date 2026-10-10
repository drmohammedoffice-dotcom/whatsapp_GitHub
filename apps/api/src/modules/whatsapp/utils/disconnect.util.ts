import { DisconnectReason } from '@whiskeysockets/baileys';
import { DisconnectInfo } from '../interfaces/session.interface';

export function parseDisconnectReason(error: unknown): DisconnectInfo {
  const boom = error as { output?: { statusCode?: number }; message?: string };
  const code = boom?.output?.statusCode;
  const message = boom?.message ?? (error instanceof Error ? error.message : 'Connection closed');
  const isLoggedOut = code === DisconnectReason.loggedOut;
  const isConnectionReplaced =
    code === DisconnectReason.connectionReplaced || /conflict|replaced/i.test(message);
  const shouldReconnect = !isLoggedOut;

  let readable = message;
  if (code === DisconnectReason.loggedOut) readable = 'Logged Out';
  else if (isConnectionReplaced) readable = 'WhatsApp open on another device — close other WhatsApp Web sessions';
  else if (code === DisconnectReason.connectionClosed) readable = 'Connection Lost';
  else if (code === DisconnectReason.restartRequired) readable = 'Restart Required';
  else if (code === DisconnectReason.timedOut) readable = 'Timeout';
  else if (code === DisconnectReason.connectionLost) readable = 'Network Error';

  return { code, message: readable, shouldReconnect, isLoggedOut, isConnectionReplaced };
}

export function toWhatsAppJid(value: string) {
  if (value.includes('@')) return value;
  return `${value.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

export function isWhatsAppJid(value?: string | null) {
  return Boolean(value?.includes('@'));
}

export function isLikelyPhoneNumber(value?: string | null) {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  // WhatsApp business numbers include country code (typically 10–15 digits).
  return digits.length >= 10 && digits.length <= 15;
}

export function phoneFromJid(jid?: string | null) {
  if (!jid || !isWhatsAppJid(jid)) return null;
  if (jid.includes('@lid')) return null;
  const phone = jid.split(':')[0]?.split('@')[0] ?? null;
  if (!phone || !isLikelyPhoneNumber(phone)) return null;
  return phone.replace(/\D/g, '');
}

export function resolveStoredPhone(input?: {
  phoneNumber?: string | null;
  jid?: string | null;
  externalId?: string | null;
}) {
  if (input?.phoneNumber && isLikelyPhoneNumber(input.phoneNumber)) {
    return input.phoneNumber.replace(/\D/g, '');
  }
  const fromJid = phoneFromJid(input?.jid) ?? phoneFromJid(input?.externalId);
  if (fromJid) return fromJid;
  if (input?.externalId && isLikelyPhoneNumber(input.externalId)) {
    return input.externalId.replace(/\D/g, '');
  }
  return null;
}

export function reconnectDelayMs(attempt: number) {
  return Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5));
}
