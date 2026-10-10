import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiTrainingMediaType, AiTrainingPlatform } from '@watsapp/database';
import { createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { parseAiTrainingPlatform } from './ai-platform';

@Injectable()
export class AiTrainingMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  list(
    teamId: string,
    platform: AiTrainingPlatform = AiTrainingPlatform.WHATSAPP,
    options?: { voiceNotesOnly?: boolean },
  ) {
    return this.prisma.aiTrainingMedia.findMany({
      where: {
        teamId,
        platform,
        ...(options?.voiceNotesOnly === true
          ? { isVoiceNote: true }
          : options?.voiceNotesOnly === false
            ? { isVoiceNote: false }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    teamId: string,
    file: UploadedMediaFile,
    input: {
      title: string;
      productName?: string;
      description?: string;
      tags?: string;
      platform?: AiTrainingPlatform;
      isVoiceNote?: boolean;
      voiceLibraryType?: 'LIBRARY' | 'PROFILE';
      category?: string;
      language?: string;
      durationSeconds?: number;
    },
  ) {
    const platform = parseAiTrainingPlatform(input.platform);
    const isVoiceNote = Boolean(input.isVoiceNote);
    const mediaType = this.detectType(file.mimetype);

    if (isVoiceNote && mediaType !== AiTrainingMediaType.AUDIO) {
      throw new BadRequestException('Voice notes must be audio files');
    }
    if (isVoiceNote && !input.description?.trim()) {
      throw new BadRequestException('Describe when this voice note should be sent');
    }

    const stored = await this.storage.putMedia(teamId, file);
    return this.prisma.aiTrainingMedia.create({
      data: {
        teamId,
        platform,
        title: input.title.trim(),
        productName: input.productName?.trim() || null,
        description: input.description?.trim() || null,
        tags: input.tags?.trim() || null,
        isVoiceNote,
        voiceLibraryType: isVoiceNote ? input.voiceLibraryType ?? 'LIBRARY' : null,
        category: input.category?.trim() || null,
        language: input.language?.trim() || null,
        durationSeconds:
          Number.isFinite(input.durationSeconds) && Number(input.durationSeconds) >= 0
            ? Math.round(Number(input.durationSeconds))
            : null,
        mediaType,
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

  /** Product / general media shown to the LLM for photo/video requests. */
  catalog(teamId: string, platform: AiTrainingPlatform = AiTrainingPlatform.WHATSAPP) {
    return this.prisma.aiTrainingMedia.findMany({
      where: { teamId, platform, isVoiceNote: false },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  /** Voice-note clips used when the customer asks for a voice reply. */
  voiceCatalog(teamId: string, platform: AiTrainingPlatform = AiTrainingPlatform.WHATSAPP) {
    return this.prisma.aiTrainingMedia.findMany({
      where: {
        teamId,
        platform,
        isVoiceNote: true,
        mediaType: AiTrainingMediaType.AUDIO,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  private detectType(mimeType: string): AiTrainingMediaType {
    if (mimeType.startsWith('image/')) return AiTrainingMediaType.IMAGE;
    if (mimeType.startsWith('video/')) return AiTrainingMediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return AiTrainingMediaType.AUDIO;
    return AiTrainingMediaType.DOCUMENT;
  }
}
