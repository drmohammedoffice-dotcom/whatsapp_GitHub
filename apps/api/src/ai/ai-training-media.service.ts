import { Injectable, NotFoundException } from '@nestjs/common';
import { AiTrainingMediaType } from '@watsapp/database';
import { createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';

@Injectable()
export class AiTrainingMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  list(teamId: string) {
    return this.prisma.aiTrainingMedia.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    teamId: string,
    file: UploadedMediaFile,
    input: { title: string; productName?: string; description?: string; tags?: string },
  ) {
    const stored = await this.storage.putMedia(teamId, file);
    return this.prisma.aiTrainingMedia.create({
      data: {
        teamId,
        title: input.title.trim(),
        productName: input.productName?.trim() || null,
        description: input.description?.trim() || null,
        tags: input.tags?.trim() || null,
        mediaType: this.detectType(file.mimetype),
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        fileName: file.originalname,
        sizeBytes: stored.sizeBytes,
      },
    });
  }

  async remove(teamId: string, id: string) {
    const row = await this.prisma.aiTrainingMedia.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Media not found');
    await this.prisma.aiTrainingMedia.delete({ where: { id } });
    return { ok: true };
  }

  async getFile(teamId: string, id: string) {
    const row = await this.prisma.aiTrainingMedia.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Media not found');
    const path = this.storage.resolvePath(row.storageKey);
    try {
      const info = await stat(path);
      return {
        stream: createReadStream(path),
        mimeType: row.mimeType,
        fileName: row.fileName ?? row.title,
        sizeBytes: info.size,
      };
    } catch {
      throw new NotFoundException('Media file is no longer available');
    }
  }

  async readBuffer(teamId: string, id: string) {
    const row = await this.prisma.aiTrainingMedia.findFirst({ where: { id, teamId } });
    if (!row) return null;
    try {
      const buffer = await readFile(this.storage.resolvePath(row.storageKey));
      return { row, buffer };
    } catch {
      return null;
    }
  }

  catalog(teamId: string) {
    return this.prisma.aiTrainingMedia.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private detectType(mimeType: string): AiTrainingMediaType {
    if (mimeType.startsWith('image/')) return AiTrainingMediaType.IMAGE;
    if (mimeType.startsWith('video/')) return AiTrainingMediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return AiTrainingMediaType.AUDIO;
    return AiTrainingMediaType.DOCUMENT;
  }
}
