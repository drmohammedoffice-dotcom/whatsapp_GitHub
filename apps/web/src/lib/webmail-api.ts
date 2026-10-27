import { API_URL } from './utils';

const WEBMAIL_TOKEN_KEY = 'chatlooraWebmailToken';

export function getWebmailToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(WEBMAIL_TOKEN_KEY);
}

export function setWebmailToken(token: string) {
  window.localStorage.setItem(WEBMAIL_TOKEN_KEY, token);
}

export function clearWebmailToken() {
  window.localStorage.removeItem(WEBMAIL_TOKEN_KEY);
}

async function webmailApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getWebmailToken();
  const response = await fetch(`${API_URL}/api/v1/webmail${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string | string[] }).message
      ? Array.isArray((body as { message: string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : String((body as { message: string }).message)
      : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function webmailLogin(email: string, password: string) {
  return webmailApi<{
    accessToken: string;
    mailbox: { id: string; email: string; displayName: string | null };
  }>('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function fetchWebmailMe() {
  return webmailApi<{ id: string; email: string; displayName: string | null; domain: string }>('/me');
}

export function fetchWebmailFolders() {
  return webmailApi<
    Array<{ path: string; name: string; specialUse: string | null; exists: number; unseen: number }>
  >('/folders');
}

export function fetchWebmailMessages(folder = 'INBOX', page = 1) {
  return webmailApi<{
    folder: string;
    total: number;
    page: number;
    pageSize: number;
    messages: Array<{
      id: string;
      uid: string;
      subject: string;
      from: string;
      to: string;
      date: string | null;
      seen: boolean;
      flagged: boolean;
      hasAttachments: boolean;
      preview: string;
    }>;
  }>(`/messages?folder=${encodeURIComponent(folder)}&page=${page}`);
}

export function fetchWebmailMessage(id: string, folder = 'INBOX') {
  return webmailApi<{
    id: string;
    uid: string;
    subject: string;
    from: string;
    to: string;
    cc: string;
    replyTo: string;
    date: string | null;
    html: string | null;
    text: string | null;
    attachments: Array<{ filename: string; contentType: string; size: number }>;
  }>(`/messages/${encodeURIComponent(id)}?folder=${encodeURIComponent(folder)}`);
}

export function deleteWebmailMessage(id: string, folder = 'INBOX') {
  return webmailApi<{ ok: boolean }>(`/messages/${encodeURIComponent(id)}?folder=${encodeURIComponent(folder)}`, {
    method: 'DELETE',
  });
}

export function sendWebmailMessage(body: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  return webmailApi<{ messageId: string }>('/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
