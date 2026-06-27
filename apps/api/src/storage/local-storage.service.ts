import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { UploadedMediaFile } from '../common/uploaded-media-file';

@Injectable()
export class LocalStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = config.get<string>('LOCAL_STORAGE_ROOT', './storage');
  }

  async putMedia(teamId: string, file: UploadedMediaFile) {
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const extension = extname(file.originalname || '') || this.extensionFromMime(file.mimetype);
    const key = normalize(`media/${teamId}/${Date.now()}-${hash}${extension}`);
    const path = join(this.root, key);
    await mkdir(join(this.root, 'media', teamId), { recursive: true });
    await writeFile(path, file.buffer);
    return { storageKey: key.replace(/\\/g, '/'), checksum: hash, sizeBytes: file.size };
  }

  async putBuffer(teamId: string, buffer: Buffer, mimeType: string, originalName?: string) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const extension = extname(originalName || '') || this.extensionFromMime(mimeType);
    const key = normalize(`media/${teamId}/${Date.now()}-${hash}${extension}`);
    const path = join(this.root, key);
    await mkdir(join(this.root, 'media', teamId), { recursive: true });
    await writeFile(path, buffer);
    return { storageKey: key.replace(/\\/g, '/'), checksum: hash, sizeBytes: buffer.length };
  }

  resolvePath(storageKey: string) {
    const safeKey = normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    return join(this.root, safeKey);
  }

  private extensionFromMime(mime: string) {
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'application/pdf') return '.pdf';
    if (mime === 'audio/ogg' || mime.startsWith('audio/ogg')) return '.ogg';
    if (mime === 'audio/mpeg') return '.mp3';
    if (mime === 'audio/mp4' || mime === 'audio/m4a') return '.m4a';
    if (mime === 'video/mp4') return '.mp4';
    if (mime.startsWith('audio/')) return '.audio';
    if (mime.startsWith('video/')) return '.video';
    if (mime.startsWith('image/')) return '.img';
    return '.bin';
  }
}
