import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { CreativeStudioService } from '../../creative-studio/creative-studio.service';

@Injectable()
export class AdminCreativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studio: CreativeStudioService,
  ) {}

  health() {
    return this.studio.providerHealth();
  }

  settings() {
    return this.prisma.creativeStudioSetting.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
    });
  }

  updateSettings(data: { defaultImageModel?: string; defaultVideoModel?: string; featureFlags?: Record<string, boolean> }) {
    return this.prisma.creativeStudioSetting.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...data, featureFlags: data.featureFlags as never },
      update: {
        defaultImageModel: data.defaultImageModel,
        defaultVideoModel: data.defaultVideoModel,
        featureFlags: data.featureFlags as Prisma.InputJsonValue,
      },
    });
  }

  listModels() {
    return this.prisma.creativeStudioModelConfig.findMany({ orderBy: [{ mediaType: 'asc' }, { priority: 'asc' }] });
  }

  createModel(data: {
    provider: string;
    modelId: string;
    mediaType: string;
    enabled?: boolean;
    priority?: number;
    isDefault?: boolean;
    isFallback?: boolean;
    maxResolution?: string;
    maxDurationSec?: number;
    qualityScore?: number;
    estimatedCostUsd?: number;
    capabilities?: Record<string, unknown>;
    notes?: string;
  }) {
    return this.prisma.creativeStudioModelConfig.create({
      data: {
        provider: data.provider,
        modelId: data.modelId,
        mediaType: data.mediaType,
        enabled: data.enabled ?? true,
        priority: data.priority ?? 50,
        isDefault: data.isDefault ?? false,
        isFallback: data.isFallback ?? false,
        maxResolution: data.maxResolution,
        maxDurationSec: data.maxDurationSec,
        qualityScore: data.qualityScore,
        estimatedCostUsd: data.estimatedCostUsd,
        capabilities: data.capabilities as Prisma.InputJsonValue,
        notes: data.notes,
      },
    });
  }

  async updateModel(id: string, data: Record<string, unknown>) {
    const row = await this.prisma.creativeStudioModelConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Model config not found');
    return this.prisma.creativeStudioModelConfig.update({
      where: { id },
      data: {
        enabled: data.enabled as boolean | undefined,
        priority: data.priority as number | undefined,
        isDefault: data.isDefault as boolean | undefined,
        isFallback: data.isFallback as boolean | undefined,
        maxResolution: data.maxResolution as string | undefined,
        maxDurationSec: data.maxDurationSec as number | undefined,
        qualityScore: data.qualityScore as number | undefined,
        estimatedCostUsd: data.estimatedCostUsd as number | undefined,
        notes: data.notes as string | undefined,
        capabilities: data.capabilities as Prisma.InputJsonValue,
      },
    });
  }
}
