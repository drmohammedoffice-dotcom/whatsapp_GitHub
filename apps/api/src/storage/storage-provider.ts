export const CREATIVE_STORAGE = 'CREATIVE_STORAGE';

export type StoredObject = {
  storageKey: string;
  checksum: string;
  sizeBytes: number;
};

export interface StorageProvider {
  putBuffer(teamId: string, buffer: Buffer, mimeType: string, originalName?: string): Promise<StoredObject>;
  putMedia(teamId: string, file: { buffer: Buffer; mimetype: string; originalname?: string; size: number }): Promise<StoredObject>;
  readBuffer(storageKey: string): Promise<Buffer>;
  resolvePath(storageKey: string): string;
  remove(storageKey: string): Promise<void>;
}
