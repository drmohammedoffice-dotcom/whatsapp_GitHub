import { MessageType } from '@watsapp/database';

export function detectMessageType(message: Record<string, unknown> | null | undefined): MessageType {
  if (!message) return MessageType.TEXT;
  if (message.imageMessage) return MessageType.IMAGE;
  if (message.documentMessage) return MessageType.DOCUMENT;
  if (message.audioMessage) return MessageType.AUDIO;
  if (message.videoMessage) return MessageType.VIDEO;
  if (message.locationMessage) return MessageType.LOCATION;
  if (message.contactMessage || message.contactsArrayMessage) return MessageType.CONTACT;
  if (message.stickerMessage) return MessageType.STICKER;
  return MessageType.TEXT;
}

export function extractMessageText(message: Record<string, unknown> | null | undefined): string | null {
  if (!message) return null;
  const conversation = message.conversation as string | undefined;
  const extended = (message.extendedTextMessage as { text?: string } | undefined)?.text;
  const imageCaption = (message.imageMessage as { caption?: string } | undefined)?.caption;
  const videoCaption = (message.videoMessage as { caption?: string } | undefined)?.caption;
  const documentCaption = (message.documentMessage as { caption?: string } | undefined)?.caption;
  return conversation ?? extended ?? imageCaption ?? videoCaption ?? documentCaption ?? null;
}

export type MediaInfo = { mimeType: string | null; fileName: string | null };

export function extractMediaInfo(message: Record<string, unknown> | null | undefined): MediaInfo | null {
  if (!message) return null;
  const image = message.imageMessage as { mimetype?: string } | undefined;
  if (image) return { mimeType: image.mimetype ?? 'image/jpeg', fileName: null };
  const video = message.videoMessage as { mimetype?: string } | undefined;
  if (video) return { mimeType: video.mimetype ?? 'video/mp4', fileName: null };
  const audio = message.audioMessage as { mimetype?: string } | undefined;
  if (audio) return { mimeType: audio.mimetype ?? 'audio/ogg', fileName: null };
  const document = message.documentMessage as { mimetype?: string; fileName?: string } | undefined;
  if (document) return { mimeType: document.mimetype ?? 'application/octet-stream', fileName: document.fileName ?? null };
  const sticker = message.stickerMessage as { mimetype?: string } | undefined;
  if (sticker) return { mimeType: sticker.mimetype ?? 'image/webp', fileName: null };
  return null;
}
