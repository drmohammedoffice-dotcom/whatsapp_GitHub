/**
 * Bridge between the web app and the ChatLoora native app (React Native WebView).
 *
 * Contract (the native side is implemented in apps/mobile):
 * - Web → native: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`
 * - Native → web: `window.dispatchEvent(new CustomEvent('chatloora:native', { detail: msg }))`
 *
 * Messages:
 * - web → native `{ type: 'download', id, fileName, mimeType, base64 }`
 *   native → web `{ type: 'download:result', id, ok, error? }`
 * - web → native `{ type: 'push:register' }`
 *   native → web `{ type: 'push:token', token, platform: 'ios' | 'android' }` or `{ type: 'push:denied' }`
 *
 * Framework-free and SSR-safe (every function is a no-op / `false` on the server).
 */

export const NATIVE_EVENT_NAME = 'chatloora:native';

export type PushPlatform = 'ios' | 'android';

export type WebToNativeMessage =
  | { type: 'download'; id: string; fileName: string; mimeType: string; base64: string }
  | { type: 'push:register' };

export type NativeToWebMessage =
  | { type: 'download:result'; id: string; ok: boolean; error?: string }
  | { type: 'push:token'; token: string; platform: PushPlatform }
  | { type: 'push:denied' };

type ReactNativeWebViewHandle = { postMessage: (message: string) => void };

declare global {
  interface Window {
    ReactNativeWebView?: ReactNativeWebViewHandle;
  }
}

/** How long to wait for the native app to confirm a download before giving up. */
const DOWNLOAD_RESULT_TIMEOUT_MS = 120_000;

/** True when running inside the ChatLoora native WebView with the message bridge available. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.ReactNativeWebView?.postMessage === 'function';
}

/** Send a message to the native app. Returns false when the bridge is not available. */
export function postToNative(message: WebToNativeMessage): boolean {
  if (!isNativeApp()) return false;
  try {
    window.ReactNativeWebView!.postMessage(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

function parseNativeMessage(detail: unknown): NativeToWebMessage | null {
  let value = detail;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const msg = value as Record<string, unknown>;
  switch (msg.type) {
    case 'download:result':
      if (typeof msg.id !== 'string') return null;
      return {
        type: 'download:result',
        id: msg.id,
        ok: msg.ok === true,
        error: typeof msg.error === 'string' ? msg.error : undefined,
      };
    case 'push:token':
      if (typeof msg.token !== 'string' || !msg.token) return null;
      if (msg.platform !== 'ios' && msg.platform !== 'android') return null;
      return { type: 'push:token', token: msg.token, platform: msg.platform };
    case 'push:denied':
      return { type: 'push:denied' };
    default:
      return null;
  }
}

/** Listen for messages from the native app. Returns an unsubscribe function. */
export function onNativeMessage(handler: (message: NativeToWebMessage) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    const message = parseNativeMessage((event as CustomEvent<unknown>).detail);
    if (message) handler(message);
  };
  window.addEventListener(NATIVE_EVENT_NAME, listener);
  return () => window.removeEventListener(NATIVE_EVENT_NAME, listener);
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function downloadInBrowser(fileName: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke later: some browsers start reading the blob asynchronously after click().
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

async function downloadInNativeApp(fileName: string, mimeType: string, blob: Blob): Promise<boolean> {
  const base64 = await blobToBase64(blob);
  const id = randomId();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(ok);
    };
    const unsubscribe = onNativeMessage((message) => {
      if (message.type === 'download:result' && message.id === id) finish(message.ok);
    });
    const timer = window.setTimeout(() => finish(false), DOWNLOAD_RESULT_TIMEOUT_MS);
    if (!postToNative({ type: 'download', id, fileName, mimeType, base64 })) finish(false);
  });
}

/**
 * Save a file for the user. Inside the native app the file is handed to the
 * app (share sheet / downloads); elsewhere a normal `<a download>` is used.
 *
 * Resolves `true` only when the file was actually handed over (native app
 * confirmed, or the browser download was triggered). Callers must only commit
 * side effects such as "last exported" markers after a `true` result.
 */
export async function downloadFile(fileName: string, mimeType: string, data: Blob | string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const type = mimeType || (data instanceof Blob && data.type) || 'application/octet-stream';
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  try {
    if (isNativeApp()) return await downloadInNativeApp(fileName, type, blob);
    return downloadInBrowser(fileName, blob);
  } catch {
    return false;
  }
}
