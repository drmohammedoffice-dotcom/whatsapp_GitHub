import { MessageType } from '@watsapp/database';

type RawMessage = Record<string, unknown> | null | undefined;

/**
 * WhatsApp wraps the real content inside container messages: disappearing
 * (ephemeral) messages, view-once messages, messages relayed from a linked
 * device, documents-with-caption and edited messages. If we read the content
 * without unwrapping these, the text comes back empty and the type falls back
 * to TEXT — which is why the UI shows a bare "TEXT" with no body. Unwrap them
 * first so the actual message can be inspected.
 */
export function unwrapMessage(message: RawMessage): Record<string, unknown> | null {
  let current = message as Record<string, unknown> | null | undefined;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const next =
      (current.ephemeralMessage as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.viewOnceMessage as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.viewOnceMessageV2Extension as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.deviceSentMessage as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.documentWithCaptionMessage as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.editedMessage as { message?: Record<string, unknown> } | undefined)?.message ??
      (current.protocolMessage as { editedMessage?: Record<string, unknown> } | undefined)?.editedMessage;
    if (!next) break;
    current = next;
  }
  return (current as Record<string, unknown>) ?? null;
}

export function detectMessageType(message: RawMessage): MessageType {
  const content = unwrapMessage(message);
  if (!content) return MessageType.TEXT;
  if (content.imageMessage) return MessageType.IMAGE;
  if (content.documentMessage) return MessageType.DOCUMENT;
  if (content.audioMessage) return MessageType.AUDIO;
  if (content.videoMessage) return MessageType.VIDEO;
  if (content.locationMessage) return MessageType.LOCATION;
  if (content.contactMessage || content.contactsArrayMessage) return MessageType.CONTACT;
  if (content.stickerMessage) return MessageType.STICKER;
  return MessageType.TEXT;
}

export function extractMessageText(message: RawMessage): string | null {
  const content = unwrapMessage(message);
  if (!content) return null;
  const conversation = content.conversation as string | undefined;
  const extended = (content.extendedTextMessage as { text?: string } | undefined)?.text;
  const imageCaption = (content.imageMessage as { caption?: string } | undefined)?.caption;
  const videoCaption = (content.videoMessage as { caption?: string } | undefined)?.caption;
  const documentCaption = (content.documentMessage as { caption?: string } | undefined)?.caption;
  const buttonsResponse = (content.buttonsResponseMessage as { selectedDisplayText?: string } | undefined)?.selectedDisplayText;
  const templateReply = (content.templateButtonReplyMessage as { selectedDisplayText?: string } | undefined)?.selectedDisplayText;
  const listResponse = (content.listResponseMessage as { title?: string } | undefined)?.title;
  const reaction = (content.reactionMessage as { text?: string } | undefined)?.text;
  return (
    conversation ??
    extended ??
    imageCaption ??
    videoCaption ??
    documentCaption ??
    buttonsResponse ??
    templateReply ??
    listResponse ??
    reaction ??
    null
  );
}

export type MediaInfo = { mimeType: string | null; fileName: string | null };

export function extractMediaInfo(message: RawMessage): MediaInfo | null {
  const content = unwrapMessage(message);
  if (!content) return null;
  const image = content.imageMessage as { mimetype?: string } | undefined;
  if (image) return { mimeType: image.mimetype ?? 'image/jpeg', fileName: null };
  const video = content.videoMessage as { mimetype?: string } | undefined;
  if (video) return { mimeType: video.mimetype ?? 'video/mp4', fileName: null };
  const audio = content.audioMessage as { mimetype?: string } | undefined;
  if (audio) return { mimeType: audio.mimetype ?? 'audio/ogg', fileName: null };
  const document = content.documentMessage as { mimetype?: string; fileName?: string } | undefined;
  if (document) return { mimeType: document.mimetype ?? 'application/octet-stream', fileName: document.fileName ?? null };
  const sticker = content.stickerMessage as { mimetype?: string } | undefined;
  if (sticker) return { mimeType: sticker.mimetype ?? 'image/webp', fileName: null };
  return null;
}
