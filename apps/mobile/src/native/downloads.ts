import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import type { DownloadRequest, NativeToWebMessage } from './bridge';

/** Files handed over by the web app are kept in the cache only until the next launch. */
const DOWNLOADS_DIR_NAME = 'chatloora-downloads';
/** 50 MB decoded; larger payloads are too heavy for the WebView bridge anyway. */
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_BYTES / 3) * 4;

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

function normalizeMimeType(mimeType: string | undefined): string | undefined {
  const value = mimeType?.split(';')[0]?.trim().toLowerCase();
  return value && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(value) ? value : undefined;
}

/**
 * Makes a web-provided name safe to use as a single file name: no directories, no control
 * or reserved characters, no bidi overrides (which can disguise the extension), bounded length.
 */
export function sanitizeFileName(raw: string, mimeType?: string): string {
  let name = (raw.split(/[\\/]/).pop() ?? '').normalize('NFC');
  name = name
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  const dot = name.lastIndexOf('.');
  let base = dot > 0 ? name.slice(0, dot) : name;
  let ext = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) : '';
  if (!ext && mimeType) ext = EXTENSION_BY_MIME[mimeType] ?? '';

  base = Array.from(base.trim()).slice(0, 100).join('') || 'chatloora-file';
  return ext ? `${base}.${ext}` : base;
}

function downloadsRoot(): Directory {
  return new Directory(Paths.cache, DOWNLOADS_DIR_NAME);
}

/** Removes files shared in earlier sessions (call once at startup). */
export function clearOldDownloads(): void {
  try {
    const dir = downloadsRoot();
    if (dir.exists) dir.delete();
  } catch {
    // Best effort: the OS also purges the cache directory.
  }
}

let busy = false;

/** Writes the web-provided file to the cache and opens the native share sheet. */
export async function saveAndShare(req: DownloadRequest): Promise<NativeToWebMessage> {
  const fail = (error: Extract<NativeToWebMessage, { ok: false }>['error']): NativeToWebMessage => ({
    type: 'download:result',
    id: req.id,
    ok: false,
    error,
  });

  if (req.base64.length > MAX_BASE64_LENGTH + 1024) return fail('too_large');
  // Accept raw base64 (standard or URL-safe) as well as a full data: URL.
  let base64 = req.base64.replace(/^data:[^,]*;base64,/i, '').replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64)) return fail('invalid_message');
  if (base64.length > MAX_BASE64_LENGTH) return fail('too_large');
  if (/[-_]/.test(base64)) base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  if (busy) return fail('busy');

  busy = true;
  try {
    if (!(await Sharing.isAvailableAsync().catch(() => false))) return fail('sharing_unavailable');

    const mimeType = normalizeMimeType(req.mimeType);
    const fileName = sanitizeFileName(req.fileName, mimeType);
    let file: File;
    try {
      // A folder per download keeps the original file name without collisions.
      const dir = new Directory(downloadsRoot(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      dir.create({ intermediates: true, idempotent: true });
      file = new File(dir, fileName);
      file.create({ overwrite: true });
      await file.write(base64, { encoding: 'base64' });
    } catch {
      return fail('write_failed');
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
    } catch {
      return fail('share_failed');
    }
    return { type: 'download:result', id: req.id, ok: true };
  } finally {
    busy = false;
  }
}
