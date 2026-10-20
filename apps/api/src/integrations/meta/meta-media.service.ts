import { Injectable, Logger } from '@nestjs/common';
import { MessageType } from '@watsapp/database';
import axios from 'axios';
import { LocalStorageService } from '../../storage/local-storage.service';

type MetaAttachmentPayload = {
  url?: string;
  sticker_id?: number;
  title?: string;
};

export type MetaAttachment = {
  type?: string;
  mime_type?: string;
  name?: string;
  file_url?: string;
  image_data?: { url?: string; width?: number; height?: number };
  payload?: MetaAttachmentPayload;
};

export type MetaMediaInput = {
  text?: string | null;
  sticker_id?: number;
  sticker?: { id?: string; url?: string; image_url?: string };
  attachments?: MetaAttachment[] | { data?: MetaAttachment[] };
};

export type ResolvedMetaMedia = {
  type: MessageType;
  text: string | null;
  mediaStorageKey?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaSizeBytes?: number;
};

@Injectable()
export class MetaMediaService {
  private readonly logger = new Logger(MetaMediaService.name);

  constructor(private readonly storage: LocalStorageService) {}

  normalizeAttachments(raw: MetaMediaInput['attachments']): MetaAttachment[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.data ?? [];
  }

  async resolveInboundMedia(
    teamId: string,
    pageAccessToken: string,
    input: MetaMediaInput,
  ): Promise<ResolvedMetaMedia> {
    const attachments = this.normalizeAttachments(input.attachments);
    const text = input.text?.trim() || null;

    if (input.sticker?.image_url || input.sticker?.url) {
      return this.downloadDirect(teamId, pageAccessToken, input.sticker.image_url ?? input.sticker.url!, MessageType.STICKER, text);
    }

    if (!attachments.length) {
      return { type: MessageType.TEXT, text };
    }

    const primary = attachments[0];
    const type = this.mapAttachmentType(primary, input.sticker_id);
    const downloadUrl = this.resolveDownloadUrl(primary);
    if (!downloadUrl) {
      return { type, text: text ?? this.fallbackLabel(type) };
    }

    try {
      const { buffer, mimeType } = await this.downloadUrl(downloadUrl, pageAccessToken);
      const fileName = primary.name ?? this.defaultFileName(type, primary.mime_type ?? mimeType);
      const stored = await this.storage.putBuffer(teamId, buffer, mimeType, fileName);
      return {
        type,
        text: text ?? this.fallbackLabel(type),
        mediaStorageKey: stored.storageKey,
        mediaMimeType: mimeType,
        mediaFileName: fileName,
        mediaSizeBytes: stored.sizeBytes,
      };
    } catch (error) {
      this.logger.warn(
        `[Meta media] download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { type, text: text ?? this.fallbackLabel(type) };
    }
  }

  private async downloadDirect(
    teamId: string,
    pageAccessToken: string,
    url: string,
    type: MessageType,
    text: string | null,
  ): Promise<ResolvedMetaMedia> {
    try {
      const { buffer, mimeType } = await this.downloadUrl(url, pageAccessToken);
      const fileName = this.defaultFileName(type, mimeType);
      const stored = await this.storage.putBuffer(teamId, buffer, mimeType, fileName);
      return {
        type,
        text: text ?? this.fallbackLabel(type),
        mediaStorageKey: stored.storageKey,
        mediaMimeType: mimeType,
        mediaFileName: fileName,
        mediaSizeBytes: stored.sizeBytes,
      };
    } catch (error) {
      this.logger.warn(
        `[Meta media] sticker download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { type, text: text ?? this.fallbackLabel(type) };
    }
  }

  private mapAttachmentType(attachment: MetaAttachment, stickerId?: number): MessageType {
    if (stickerId || attachment.payload?.sticker_id) return MessageType.STICKER;
    const kind = (attachment.type ?? '').toLowerCase();
    if (kind === 'video') return MessageType.VIDEO;
    if (kind === 'audio') return MessageType.AUDIO;
    if (kind === 'file') return MessageType.DOCUMENT;
    if (kind === 'image' || attachment.image_data?.url) return MessageType.IMAGE;
    return MessageType.IMAGE;
  }

  private resolveDownloadUrl(attachment: MetaAttachment): string | null {
    return (
      attachment.file_url ??
      attachment.image_data?.url ??
      attachment.payload?.url ??
      null
    );
  }

  private async downloadUrl(url: string, pageAccessToken: string) {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      params: { access_token: pageAccessToken },
      maxRedirects: 5,
      timeout: 30_000,
    });
    const mimeType =
      (response.headers['content-type'] as string | undefined)?.split(';')[0]?.trim() ??
      'application/octet-stream';
    return { buffer: Buffer.from(response.data), mimeType };
  }

  private defaultFileName(type: MessageType, mimeType: string) {
    const ext = mimeType.includes('webp')
      ? '.webp'
      : mimeType.includes('png')
        ? '.png'
        : mimeType.includes('gif')
          ? '.gif'
          : mimeType.includes('jpeg') || mimeType.includes('jpg')
            ? '.jpg'
            : mimeType.includes('mp4')
              ? '.mp4'
              : mimeType.includes('audio')
                ? '.mp3'
                : '';
    const base =
      type === MessageType.STICKER
        ? 'sticker'
        : type === MessageType.VIDEO
          ? 'video'
          : type === MessageType.AUDIO
            ? 'audio'
            : type === MessageType.DOCUMENT
              ? 'file'
              : 'image';
    return `${base}-${Date.now()}${ext || '.bin'}`;
  }

  private fallbackLabel(type: MessageType) {
    switch (type) {
      case MessageType.STICKER:
        return '[Sticker]';
      case MessageType.VIDEO:
        return '[Video]';
      case MessageType.AUDIO:
        return '[Audio]';
      case MessageType.DOCUMENT:
        return '[File]';
      case MessageType.IMAGE:
        return '[Image]';
      default:
        return null;
    }
  }
}
