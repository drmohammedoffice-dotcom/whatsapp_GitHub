export function phoneFromJid(jid?: string | null): string | null {
  if (!jid) return null;
  const user = jid.split('@')[0] ?? '';
  const digits = user.replace(/[^\d]/g, '');
  return digits || null;
}

export function resolveStoredPhone(input: {
  phoneNumber?: string | null;
  jid?: string | null;
  externalId?: string | null;
}): string | null {
  if (input.phoneNumber) {
    const digits = String(input.phoneNumber).replace(/[^\d]/g, '');
    if (digits) return digits;
  }
  const fromJid = phoneFromJid(input.jid);
  if (fromJid) return fromJid;
  if (input.externalId) {
    const digits = String(input.externalId).replace(/[^\d]/g, '');
    if (digits) return digits;
  }
  return null;
}

export function parseDisconnectReason() {
  return { code: null, message: null };
}
