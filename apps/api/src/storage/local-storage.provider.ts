import { Injectable } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import type { StorageProvider, StoredObject } from './storage-provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly local: LocalStorageService) {}

  putBuffer(teamId: string, buffer: Buffer, mimeType: string, originalName?: string): Promise<StoredObject> {
    return this.local.putBuffer(teamId, buffer, mimeType, originalName);
  }

  putMedia(
    teamId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string; size: number },
  ): Promise<StoredObject> {
    return this.local.putMedia(teamId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname || 'upload.bin',
      size: file.size,
    });
  }

  resolvePath(storageKey: string): string {
    return this.local.resolvePath(storageKey);
  }

  remove(storageKey: string): Promise<void> {
    return this.local.remove(storageKey);
  }

  readBuffer(storageKey: string): Promise<Buffer> {
    return this.local.readBuffer(storageKey);
  }
}
