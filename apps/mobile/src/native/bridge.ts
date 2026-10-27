/**
 * Web <-> native message contract (agreed with the web team).
 *
 * Web -> native: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`
 * Native -> web: `window.dispatchEvent(new CustomEvent('chatloora:native', { detail: msg }))`
 */
import { TRUSTED_BRIDGE_HOSTS } from '../config';

export type MessageId = string | number;

export type DownloadRequest = {
  type: 'download';
  id: MessageId;
  fileName: string;
  mimeType?: string;
  base64: string;
};

export type WebToNativeMessage = DownloadRequest | { type: 'push:register' };

export type DownloadError =
  | 'invalid_message'
  | 'too_large'
  | 'busy'
  | 'sharing_unavailable'
  | 'write_failed'
  | 'share_failed';

export type NativeToWebMessage =
  | { type: 'download:result'; id: MessageId; ok: true }
  | { type: 'download:result'; id: MessageId; ok: false; error: DownloadError }
  | { type: 'push:token'; token: string; platform: 'ios' | 'android' }
  /** `reason` is extra: `permission` = user declined, `unavailable` = no token could be issued. */
  | { type: 'push:denied'; reason: 'permission' | 'unavailable' };

function isMessageId(value: unknown): value is MessageId {
  return (typeof value === 'string' && value.length > 0 && value.length <= 200) || (typeof value === 'number' && Number.isFinite(value));
}

/** Parses a WebView message; returns null for anything that is not part of the contract. */
export function parseWebMessage(raw: string): WebToNativeMessage | null {
  // Cheap pre-check so unrelated postMessage traffic is not JSON-parsed.
  if (typeof raw !== 'string' || raw.length < 2 || raw[0] !== '{') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const msg = data as Record<string, unknown>;

  if (msg.type === 'push:register') return { type: 'push:register' };

  if (msg.type === 'download' && isMessageId(msg.id)) {
    // A malformed payload is still answered (with `invalid_message`), so keep the id.
    return {
      type: 'download',
      id: msg.id,
      fileName: typeof msg.fileName === 'string' ? msg.fileName : '',
      mimeType: typeof msg.mimeType === 'string' ? msg.mimeType : undefined,
      base64: typeof msg.base64 === 'string' ? msg.base64 : '',
    };
  }
  return null;
}

/**
 * Script that delivers a message to the page. It only dispatches when the page currently
 * shown is ChatLoora, so a reply never reaches a third-party page the user navigated to
 * while the native side was busy (permission prompt, share sheet).
 */
export function buildNativeEventScript(msg: NativeToWebMessage): string {
  const hosts = JSON.stringify(TRUSTED_BRIDGE_HOSTS);
  const detail = JSON.stringify(msg);
  return `(function(){try{var h=location.hostname;var ok=${hosts}.some(function(d){return h===d||h.slice(-d.length-1)==='.'+d;});if(ok){window.dispatchEvent(new CustomEvent('chatloora:native',{detail:${detail}}));}}catch(e){}})();true;`;
}
