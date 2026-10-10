import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CreativeJobStatus, CreativeJobType, Prisma } from '@watsapp/database';
import { Queue } from 'bullmq';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import { CREATIVE_STORAGE, type StorageProvider } from '../storage/storage-provider';
import {
  CreateCreativeJobDto,
  CreateCreativeProjectDto,
  ModelProfileDto,
  UpdateCreativeProjectDto,
  UpsertProductProfileDto,
} from './dto/creative.dto';
import { ProductIntelligenceService } from './product-intelligence.service';
import { CreativeGenerationService } from './generation.service';
import { parseEditIntent } from './edit-intent';
import { isFourKRequest } from './resolution';
import { parseModelJson } from './json';
import { captionsFromScript } from './captions';
import { AD_PLATFORM_PRESETS } from './platform-presets';
import {
  PROVIDER_NOT_CONFIGURED,
  ProviderError,
  ENTITLEMENT_EXCEEDED,
  FOUR_K_NOT_ENABLED,
  IRAQI_TTS_NOT_CONFIGURED,
  LIPSYNC_NOT_CONFIGURED,
  FOUR_K_UPSCALE_NOT_CONFIGURED,
  MUSIC_NOT_CONFIGURED,
} from './providers/provider-error';
import { IraqiTTSProvider, LipSyncProvider, LicensedMusicProvider, UpscaleProvider } from './providers/future.providers';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ProviderRegistry } from './providers/provider-registry';

export type CreativePipelineJob = { generationJobId: string; teamId: string };

const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const CONFIGURED_PROVIDERS = new Set(['gemini', 'openai', 'openrouter']);

@Injectable()
export class CreativeStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly openai: OpenAIProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly gemini: GeminiProvider,
    private readonly registry: ProviderRegistry,
    private readonly intelligence: ProductIntelligenceService,
    private readonly generation: CreativeGenerationService,
    private readonly iraqiTts: IraqiTTSProvider,
    private readonly lipSync: LipSyncProvider,
    private readonly upscale: UpscaleProvider,
    private readonly music: LicensedMusicProvider,
    @Inject(CREATIVE_STORAGE) private readonly storage: StorageProvider,
    @InjectQueue(QUEUES.CREATIVE_PIPELINE) private readonly queue: Queue<CreativePipelineJob>,
  ) {}

  async assertAccess(teamId: string) {
    await this.entitlements.assertCreativeStudioEnabled(teamId);
  }

  requireUserId(userId?: string) {
    if (!userId) throw new BadRequestException('A signed-in user is required for Creative Studio.');
    return userId;
  }

  status() {
    return {
      openaiConfigured: this.openai.isConfigured(),
      openrouterConfigured: this.openrouter.isConfigured(),
      geminiConfigured: this.gemini.isConfigured(),
      storage: 'local',
      pipeline: QUEUES.CREATIVE_PIPELINE,
      processorHost: 'apps/worker',
      mediaGenerationEnabled: true,
      imageGenerationEnabled: this.gemini.isConfigured() || this.openai.isConfigured() || this.openrouter.isConfigured(),
      videoGenerationEnabled: this.gemini.isConfigured() || this.openrouter.isConfigured(),
      defaultMediaProvider: this.gemini.isConfigured() ? 'gemini' : this.openrouter.isConfigured() ? 'openrouter' : 'openai',
      tts: this.openai.isConfigured() ? { status: 'CONFIGURED', dialect: 'msa', iraqi: 'IRAQI_TTS_NOT_CONFIGURED' } : { status: 'NOT_CONFIGURED' },
      lipSync: { status: 'NOT_CONFIGURED' },
      music: { status: 'NOT_CONFIGURED', userUpload: true },
      upscale4k: { status: '4K_UPSCALE_NOT_CONFIGURED' },
      ffmpeg: 'worker',
    };
  }

  providers() {
    return this.registry.snapshot();
  }

  probe(provider: 'openai' | 'openrouter' | 'gemini' = 'gemini') {
    if (provider === 'gemini') return this.gemini.authenticate();
    if (provider === 'openrouter') return this.openrouter.authenticate();
    return this.openai.authenticate();
  }

  listProjects(teamId: string) {
    return this.prisma.creativeProject.findMany({
      where: { teamId },
      orderBy: { updatedAt: 'desc' },
      include: { productProfile: true, _count: { select: { jobs: true, assets: true } } },
    });
  }

  async getProject(teamId: string, id: string) {
    const project = await this.prisma.creativeProject.findFirst({
      where: { id, teamId },
      include: {
        productProfile: true,
        assets: { orderBy: { position: 'asc' } },
        briefs: true,
        concepts: { orderBy: { position: 'asc' } },
        jobs: { orderBy: { createdAt: 'desc' }, take: 20, include: { assets: true, qualityChecks: true } },
        editRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        scenes: { orderBy: { order: 'asc' } },
        versions: { orderBy: { version: 'desc' } },
        continuity: true,
        scripts: { include: { scenes: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 3 },
        captionTracks: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  createProject(teamId: string, userId: string | undefined, dto: CreateCreativeProjectDto) {
    return this.prisma.creativeProject.create({
      data: {
        teamId,
        userId: this.requireUserId(userId),
        name: dto.name.trim(),
        contentKind: dto.contentKind as never,
        aspectRatio: dto.aspectRatio,
        locale: dto.locale || 'ar-IQ',
      },
    });
  }

  async updateProject(teamId: string, id: string, dto: UpdateCreativeProjectDto) {
    await this.getProject(teamId, id);
    return this.prisma.creativeProject.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.contentKind ? { contentKind: dto.contentKind as never } : {}),
        ...(dto.aspectRatio !== undefined ? { aspectRatio: dto.aspectRatio } : {}),
        ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
      },
    });
  }

  async deleteProject(teamId: string, id: string) {
    const project = await this.getProject(teamId, id);
    for (const asset of project.assets) await this.storage.remove(asset.storageKey);
    await this.prisma.creativeProject.delete({ where: { id } });
    return { ok: true };
  }

  async upsertProduct(teamId: string, userId: string | undefined, projectId: string, dto: UpsertProductProfileDto) {
    await this.getProject(teamId, projectId);
    const ownerId = this.requireUserId(userId);
    return this.prisma.creativeProductProfile.upsert({
      where: { projectId },
      create: { teamId, userId: ownerId, projectId, ...dto, name: dto.name.trim() },
      update: { ...dto, name: dto.name.trim() },
    });
  }

  async addAsset(teamId: string, userId: string | undefined, projectId: string, file: UploadedMediaFile, isMain?: boolean) {
    const ownerId = this.requireUserId(userId);
    await this.getProject(teamId, projectId);
    if (!IMAGE_MIME.has(file.mimetype)) throw new BadRequestException('Only JPG, PNG, or WEBP images are allowed.');
    if (file.size > 12 * 1024 * 1024) throw new BadRequestException('Image is too large.');
    const stored = await this.storage.putMedia(teamId, file);
    const count = await this.prisma.creativeProductAsset.count({ where: { projectId } });
    if (isMain) {
      await this.prisma.creativeProductAsset.updateMany({ where: { projectId }, data: { isMain: false } });
    }
    return this.prisma.creativeProductAsset.create({
      data: {
        teamId,
        userId: ownerId,
        projectId,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        fileName: file.originalname,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        position: count,
        isMain: Boolean(isMain) || count === 0,
      },
    });
  }

  async removeAsset(teamId: string, id: string) {
    const asset = await this.prisma.creativeProductAsset.findFirst({ where: { id, teamId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.storage.remove(asset.storageKey);
    await this.prisma.creativeProductAsset.delete({ where: { id } });
    return { ok: true };
  }

  isProviderConfigured(provider: string) {
    if (provider === 'gemini') return this.gemini.isConfigured();
    if (provider === 'openai') return this.openai.isConfigured();
    if (provider === 'openrouter') return this.openrouter.isConfigured();
    return false;
  }

  async createJob(teamId: string, userId: string | undefined, dto: CreateCreativeJobDto) {
    const ownerId = this.requireUserId(userId);
    const project = await this.getProject(teamId, dto.projectId);
    const type = dto.type as CreativeJobType;
    const defaultMediaProvider = this.gemini.isConfigured() ? 'gemini' : 'openrouter';
    let provider =
      dto.provider ||
      (type === CreativeJobType.PROBE || type === CreativeJobType.TTS
        ? this.openai.isConfigured()
          ? 'openai'
          : defaultMediaProvider
        : type === CreativeJobType.COMPOSE
          ? 'ffmpeg'
          : defaultMediaProvider);
    if (type === CreativeJobType.LIPSYNC) {
      throw new ProviderError(LIPSYNC_NOT_CONFIGURED, 'Lip-sync is not configured.', 501);
    }
    if (type === CreativeJobType.UPSCALE) {
      throw new ProviderError(FOUR_K_UPSCALE_NOT_CONFIGURED, '4K upscaling is not configured.', 501);
    }
    if (type === CreativeJobType.TTS && (String(dto.instruction || '').match(/عراق|iraqi/i) || dto.provider === 'iraqi-tts')) {
      throw new ProviderError(IRAQI_TTS_NOT_CONFIGURED, 'Iraqi Arabic TTS is not configured.', 501);
    }
    const idempotencyKey = dto.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = await this.prisma.creativeGenerationJob.findFirst({
        where: { teamId, idempotencyKey },
      });
      if (existing) return existing;
    }

    const configured = this.isProviderConfigured(provider) || (type === CreativeJobType.COMPOSE && provider === 'ffmpeg');
    let status: CreativeJobStatus = CreativeJobStatus.QUEUED;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    if (!CONFIGURED_PROVIDERS.has(provider) || !configured) {
      status = CreativeJobStatus.FAILED;
      errorCode = PROVIDER_NOT_CONFIGURED;
      errorMessage = 'المزود غير معدّ. أضف المفتاح في إعدادات الخادم.';
    } else if (
      type === CreativeJobType.IMAGE ||
      type === CreativeJobType.VIDEO ||
      type === CreativeJobType.EDIT ||
      type === CreativeJobType.TTS
    ) {
      await this.assertGenerationLimits(teamId, type, dto.resolution, dto.durationSec);
    }

    let job;
    try {
      job = await this.prisma.creativeGenerationJob.create({
        data: {
          teamId,
          userId: ownerId,
          projectId: project.id,
          type,
          provider,
          model: dto.model,
          sceneId: dto.sceneId || null,
          ...(idempotencyKey ? { idempotencyKey } : {}),
          payload: {
            requestedAt: new Date().toISOString(),
            aspectRatio: dto.aspectRatio,
            resolution: dto.resolution,
            durationSec: dto.durationSec,
            instruction: dto.instruction,
            userInstructions: dto.userInstructions,
            videoMode: dto.videoMode,
            conceptId: dto.conceptId,
            variationCount: dto.variationCount,
            sceneId: dto.sceneId,
            script: dto.script,
            voice: dto.voice,
            dialect: dto.dialect,
            gender: dto.gender,
            musicTrackId: dto.musicTrackId,
          } as Prisma.InputJsonValue,
          status,
          errorCode,
          errorMessage,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencyKey) {
        const existing = await this.prisma.creativeGenerationJob.findFirst({ where: { teamId, idempotencyKey } });
        if (existing) return existing;
      }
      throw error;
    }

    await this.prisma.creativeUsageRecord.create({
      data: {
        teamId,
        userId: ownerId,
        jobId: job.id,
        provider,
        model: dto.model,
        operation: type,
        status: job.status,
        mediaType: type === CreativeJobType.VIDEO ? 'video' : type === CreativeJobType.PROBE ? 'probe' : 'image',
        resolution: dto.resolution,
        durationSec: dto.durationSec,
        costStatus: 'UNKNOWN',
      },
    });

    if (job.status === CreativeJobStatus.QUEUED) {
      try {
        await this.queue.add(
          'run',
          { generationJobId: job.id, teamId },
          {
            jobId: `creative-${job.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 200,
            removeOnFail: 200,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'تعذر إضافة المهمة إلى قائمة المعالجة.';
        await this.prisma.creativeGenerationJob.update({
          where: { id: job.id },
          data: {
            status: CreativeJobStatus.FAILED,
            finishedAt: new Date(),
            errorCode: 'QUEUE_ENQUEUE_FAILED',
            errorMessage: message,
          },
        });
        await this.prisma.creativeUsageRecord.updateMany({
          where: { jobId: job.id },
          data: { status: 'FAILED' },
        });
        throw new BadRequestException(`تعذر تشغيل مهمة الاستوديو: ${message}`);
      }
    }
    return job;
  }

  async getJob(teamId: string, id: string) {
    const job = await this.prisma.creativeGenerationJob.findFirst({
      where: { id, teamId },
      include: { assets: true, usageRecords: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async retryJob(teamId: string, id: string) {
    const job = await this.getJob(teamId, id);
    if (job.status !== CreativeJobStatus.FAILED && job.status !== CreativeJobStatus.CANCELLED) {
      throw new BadRequestException('Only failed or cancelled jobs can be retried.');
    }
    if (!this.isProviderConfigured(job.provider)) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'المزود غير معدّ. أضف المفتاح في إعدادات الخادم.', 503);
    }
    const updated = await this.prisma.creativeGenerationJob.update({
      where: { id },
      data: { status: CreativeJobStatus.QUEUED, errorCode: null, errorMessage: null, finishedAt: null },
    });
    await this.queue.add(
      'run',
      { generationJobId: job.id, teamId },
      {
        jobId: `creative-${job.id}-r${job.attempts + 1}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    return updated;
  }

  async cancelJob(teamId: string, id: string) {
    const job = await this.getJob(teamId, id);
    if (job.status === CreativeJobStatus.SUCCEEDED) throw new BadRequestException('Completed jobs cannot be cancelled.');
    return this.prisma.creativeGenerationJob.update({
      where: { id },
      data: { status: CreativeJobStatus.CANCELLED, finishedAt: new Date() },
    });
  }

  async processQueuedJob(generationJobId: string) {
    const job = await this.prisma.creativeGenerationJob.findUnique({ where: { id: generationJobId } });
    if (!job || job.status === CreativeJobStatus.CANCELLED || job.status === CreativeJobStatus.SUCCEEDED) return;
    await this.prisma.creativeGenerationJob.update({
      where: { id: job.id },
      data: { status: CreativeJobStatus.RUNNING, startedAt: job.startedAt ?? new Date(), attempts: { increment: 1 } },
    });
    try {
      if (job.type === CreativeJobType.PROBE) {
        if (!this.isProviderConfigured(job.provider)) {
          throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'المزود غير معدّ. أضف المفتاح في إعدادات الخادم.', 503);
        }
        const result =
          job.provider === 'gemini'
            ? await this.gemini.authenticate()
            : job.provider === 'openrouter'
              ? await this.openrouter.authenticate()
              : await this.openai.authenticate();
        await this.prisma.creativeGenerationJob.update({
          where: { id: job.id },
          data: {
            status: CreativeJobStatus.SUCCEEDED,
            finishedAt: new Date(),
            result: result as unknown as Prisma.InputJsonValue,
          },
        });
        await this.prisma.creativeUsageRecord.updateMany({ where: { jobId: job.id }, data: { status: 'SUCCEEDED' } });
        await this.prisma.aiCostEvent.create({
          data: { teamId: job.teamId, provider: job.provider, model: job.model || 'probe', operation: 'creative.probe', costCents: 0 },
        });
        return;
      }
      await this.generation.process(job.id);
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : 'PROVIDER_ERROR';
      const message = error instanceof ProviderError ? error.message : 'تعذر إكمال المهمة حالياً. حاول مرة أخرى.';
      await this.prisma.creativeGenerationJob.update({
        where: { id: job.id },
        data: { status: CreativeJobStatus.FAILED, finishedAt: new Date(), errorCode: code, errorMessage: message },
      });
      await this.prisma.creativeUsageRecord.updateMany({ where: { jobId: job.id }, data: { status: 'FAILED' } });
      if (this.generation.retryable(error)) throw error;
    }
  }

  async analyzeProduct(teamId: string, userId: string | undefined, projectId: string) {
    const ownerId = this.requireUserId(userId);
    const project = await this.getProject(teamId, projectId);
    const images = [];
    for (const asset of project.assets.slice(0, 4)) {
      const buf = await this.storage.readBuffer(asset.storageKey);
      images.push({ mimeType: asset.mimeType, dataBase64: buf.toString('base64') });
    }
    await this.prisma.creativeProject.update({ where: { id: projectId }, data: { status: 'ANALYZING' } });
    return this.intelligence.analyze(teamId, ownerId, projectId, images);
  }

  generateBrief(teamId: string, userId: string | undefined, projectId: string, hints?: Record<string, string | undefined>) {
    return this.intelligence.generateBrief(teamId, this.requireUserId(userId), projectId, hints);
  }

  generateConcepts(teamId: string, userId: string | undefined, projectId: string) {
    return this.intelligence.generateConcepts(teamId, this.requireUserId(userId), projectId);
  }

  async selectConcept(teamId: string, projectId: string, conceptId: string) {
    await this.getProject(teamId, projectId);
    const concept = await this.prisma.creativeConcept.findFirst({ where: { id: conceptId, teamId, projectId } });
    if (!concept) throw new NotFoundException('Concept not found');
    await this.prisma.creativeConcept.updateMany({ where: { projectId, teamId }, data: { selected: false } });
    return this.prisma.creativeConcept.update({ where: { id: conceptId }, data: { selected: true } });
  }

  async upsertModelProfile(teamId: string, userId: string | undefined, dto: ModelProfileDto) {
    const ownerId = this.requireUserId(userId);
    return this.prisma.creativeModelProfile.create({
      data: {
        teamId,
        userId: ownerId,
        name: (dto.name || 'Model').trim(),
        gender: dto.gender,
        ageRange: dto.ageRange,
        skinTone: dto.skinTone,
        hair: dto.hair,
        clothing: dto.clothing,
        persona: dto.persona,
        expression: dto.expression,
        pose: dto.pose,
        profession: dto.profession,
        visualIdentity: dto.visualIdentity,
        environment: dto.environment,
      },
    });
  }

  parseEdit(teamId: string, userId: string | undefined, projectId: string, instruction: string) {
    const ownerId = this.requireUserId(userId);
    const parsed = parseEditIntent(instruction);
    return this.prisma.creativeEditRequest.create({
      data: {
        teamId,
        userId: ownerId,
        projectId,
        instruction,
        parsedPlan: parsed as never,
        status: 'PARSED',
      },
    });
  }

  async openGeneratedFile(teamId: string, assetId: string) {
    const asset = await this.prisma.creativeGenerationAsset.findFirst({ where: { id: assetId, teamId } });
    if (!asset) throw new NotFoundException('Asset not found');
    const { createReadStream } = await import('fs');
    const { stat } = await import('fs/promises');
    const path = this.storage.resolvePath(asset.storageKey);
    const info = await stat(path);
    return { stream: createReadStream(path), mimeType: asset.mimeType, sizeBytes: info.size, fileName: 'generated' };
  }

  async openProductAsset(teamId: string, assetId: string) {
    const asset = await this.prisma.creativeProductAsset.findFirst({ where: { id: assetId, teamId } });
    if (!asset) throw new NotFoundException('Asset not found');
    const { createReadStream } = await import('fs');
    return { stream: createReadStream(this.storage.resolvePath(asset.storageKey)), mimeType: asset.mimeType };
  }

  private async assertGenerationLimits(teamId: string, type: CreativeJobType, resolution?: string, durationSec?: number) {
    const entitlements = await this.entitlements.assertCreativeStudioEnabled(teamId);
    const limits = entitlements.limits;
    if (isFourKRequest(resolution) && !limits.creative4kEnabled) {
      throw new ProviderError(FOUR_K_NOT_ENABLED, 'توليد 4K غير مضمّن في باقتك.', 403);
    }
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const inflight = [
      CreativeJobStatus.QUEUED,
      CreativeJobStatus.RUNNING,
      CreativeJobStatus.PROVIDER_SUBMITTED,
      CreativeJobStatus.POLLING,
      CreativeJobStatus.DOWNLOADING,
      CreativeJobStatus.STORING,
      CreativeJobStatus.QUALITY_CHECK,
    ];
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`creative-quota-${teamId}`}))`;
      if (type === CreativeJobType.IMAGE || type === CreativeJobType.EDIT) {
        const used = await tx.creativeUsageRecord.count({
          where: { teamId, operation: { in: ['IMAGE', 'EDIT'] }, status: 'SUCCEEDED', createdAt: { gte: monthStart } },
        });
        const running = await tx.creativeGenerationJob.count({
          where: { teamId, type: { in: [CreativeJobType.IMAGE, CreativeJobType.EDIT] }, status: { in: inflight } },
        });
        if (limits.creativeImagesLimit !== -1 && used + running >= limits.creativeImagesLimit) {
          throw new ProviderError(ENTITLEMENT_EXCEEDED, 'وصلت لحد صور الاستوديو الإبداعي هذا الشهر.', 403);
        }
      }
      if (type === CreativeJobType.VIDEO) {
        const sum = await tx.creativeUsageRecord.aggregate({
          where: { teamId, operation: 'VIDEO', status: 'SUCCEEDED', createdAt: { gte: monthStart } },
          _sum: { durationSec: true },
        });
        const used = sum._sum.durationSec || 0;
        const next = durationSec || 5;
        if (limits.creativeVideoSecondsLimit !== -1 && used + next > limits.creativeVideoSecondsLimit) {
          throw new ProviderError(ENTITLEMENT_EXCEEDED, 'وصلت لحد ثواني الفيديو هذا الشهر.', 403);
        }
      }
    });
  }

  presets() {
    return AD_PLATFORM_PRESETS;
  }

  async dashboard(teamId: string) {
    const [projects, recentJobs, failed] = await Promise.all([
      this.prisma.creativeProject.findMany({
        where: { teamId },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: { productProfile: true, versions: { where: { isCurrent: true }, take: 1 }, _count: { select: { jobs: true, scenes: true } } },
      }),
      this.prisma.creativeGenerationJob.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { assets: true },
      }),
      this.prisma.creativeGenerationJob.findMany({
        where: { teamId, status: CreativeJobStatus.FAILED },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return {
      projects,
      recentGenerations: recentJobs,
      drafts: projects.filter((p) => p.status === 'DRAFT'),
      failedJobs: failed,
    };
  }

  async providerHealth() {
    const check = async (id: string, configured: boolean, fn: () => Promise<unknown>) => {
      if (!configured) return { provider: id, status: 'NOT_CONFIGURED' as const };
      try {
        await fn();
        return { provider: id, status: 'CONNECTED' as const };
      } catch (error) {
        const code = error instanceof ProviderError ? error.code : 'UNAVAILABLE';
        if (code === 'PROVIDER_AUTH_FAILED') return { provider: id, status: 'AUTH_FAILED' as const };
        if (code === 'PROVIDER_RATE_LIMITED') return { provider: id, status: 'RATE_LIMITED' as const };
        return { provider: id, status: 'UNAVAILABLE' as const };
      }
    };
    const [gemini, openai, openrouter] = await Promise.all([
      check('gemini', this.gemini.isConfigured(), () => this.gemini.authenticate()),
      check('openai', this.openai.isConfigured(), () => this.openai.authenticate()),
      check('openrouter', this.openrouter.isConfigured(), () => this.openrouter.authenticate()),
    ]);
    return {
      gemini,
      openai,
      openrouter,
      iraqiTts: { provider: 'iraqi-tts', status: this.iraqiTts.isConfigured() ? 'CONNECTED' : 'NOT_CONFIGURED' },
      lipsync: { provider: 'lipsync', status: this.lipSync.isConfigured() ? 'CONNECTED' : 'NOT_CONFIGURED' },
      music: { provider: 'licensed-music', status: this.music.isConfigured() ? 'CONNECTED' : 'NOT_CONFIGURED' },
      upscale: { provider: 'upscale', status: this.upscale.isConfigured() ? 'CONNECTED' : 'NOT_CONFIGURED' },
    };
  }

  async listScenes(teamId: string, projectId: string) {
    await this.getProject(teamId, projectId);
    return this.prisma.creativeVideoScene.findMany({ where: { teamId, projectId }, orderBy: { order: 'asc' } });
  }

  async upsertScenes(
    teamId: string,
    userId: string | undefined,
    projectId: string,
    scenes: Array<{
      id?: string;
      order: number;
      durationSec?: number;
      role?: string;
      script?: string;
      environment?: string;
      visualInstructions?: string;
      camera?: string;
      transition?: string;
      modelProfileId?: string;
    }>,
  ) {
    const ownerId = this.requireUserId(userId);
    await this.getProject(teamId, projectId);
    const kept = [];
    for (const scene of scenes) {
      if (scene.id) {
        kept.push(
          await this.prisma.creativeVideoScene.update({
            where: { id: scene.id },
            data: {
              order: scene.order,
              durationSec: scene.durationSec,
              role: scene.role,
              script: scene.script,
              environment: scene.environment,
              visualInstructions: scene.visualInstructions,
              camera: scene.camera,
              transition: scene.transition,
              modelProfileId: scene.modelProfileId,
            },
          }),
        );
      } else {
        kept.push(
          await this.prisma.creativeVideoScene.create({
            data: {
              teamId,
              userId: ownerId,
              projectId,
              order: scene.order,
              durationSec: scene.durationSec || 5,
              role: scene.role,
              script: scene.script,
              environment: scene.environment,
              visualInstructions: scene.visualInstructions,
              camera: scene.camera,
              transition: scene.transition,
              modelProfileId: scene.modelProfileId,
            },
          }),
        );
      }
    }
    return kept;
  }

  async patchScene(teamId: string, sceneId: string, data: Record<string, unknown>) {
    const scene = await this.prisma.creativeVideoScene.findFirst({ where: { id: sceneId, teamId } });
    if (!scene) throw new NotFoundException('Scene not found');
    return this.prisma.creativeVideoScene.update({
      where: { id: sceneId },
      data: {
        durationSec: data.durationSec as number | undefined,
        script: data.script as string | undefined,
        environment: data.environment as string | undefined,
        visualInstructions: data.visualInstructions as string | undefined,
        camera: data.camera as string | undefined,
        transition: data.transition as string | undefined,
        role: data.role as string | undefined,
        modelProfileId: data.modelProfileId as string | undefined,
      },
    });
  }

  async deleteScene(teamId: string, sceneId: string) {
    const scene = await this.prisma.creativeVideoScene.findFirst({ where: { id: sceneId, teamId } });
    if (!scene) throw new NotFoundException('Scene not found');
    await this.prisma.creativeVideoScene.delete({ where: { id: sceneId } });
    return { ok: true };
  }

  async duplicateScene(teamId: string, userId: string | undefined, sceneId: string) {
    const scene = await this.prisma.creativeVideoScene.findFirst({ where: { id: sceneId, teamId } });
    if (!scene) throw new NotFoundException('Scene not found');
    const count = await this.prisma.creativeVideoScene.count({ where: { projectId: scene.projectId } });
    return this.prisma.creativeVideoScene.create({
      data: {
        teamId,
        userId: this.requireUserId(userId),
        projectId: scene.projectId,
        order: count,
        durationSec: scene.durationSec,
        role: scene.role,
        script: scene.script,
        environment: scene.environment,
        visualInstructions: scene.visualInstructions,
        camera: scene.camera,
        transition: scene.transition,
        modelProfileId: scene.modelProfileId,
      },
    });
  }

  async generateScript(teamId: string, userId: string | undefined, projectId: string, dialect?: string) {
    const ownerId = this.requireUserId(userId);
    const project = await this.getProject(teamId, projectId);
    if (!this.openai.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ للنصوص.', 503);
    const wantsIraqi = (dialect || project.locale || '').toLowerCase().includes('iq');
    const result = await this.openai.completeText({
      model: this.registry.openaiTextModel(),
      json: true,
      system: `You write advertising scripts. Return JSON {hook, introduction, product, benefits, cta, scenes:[{order,role,durationSec,voiceover,visual,camera}]}.
Roles: HOOK, PROBLEM, PRODUCT, BENEFIT, CTA. Never invent medical/scientific claims. Use only user-provided product facts.
${wantsIraqi ? 'Write spoken lines in natural Iraqi Arabic (Baghdad-style colloquial), not MSA.' : 'Write in the requested language.'}`,
      user: JSON.stringify({
        product: project.productProfile,
        brief: project.briefs[0],
        locale: project.locale,
        durationSec: project.durationSec || 30,
      }),
    });
    const parsed = parseModelJson<{
      hook?: string;
      introduction?: string;
      product?: string;
      benefits?: string;
      cta?: string;
      scenes?: Array<{ order: number; role: string; durationSec?: number; voiceover?: string; visual?: string; camera?: string }>;
    }>(result.text);
    const script = await this.prisma.creativeScript.create({
      data: {
        teamId,
        userId: ownerId,
        projectId,
        language: wantsIraqi ? 'ar-IQ' : project.locale,
        durationSec: project.durationSec || 30,
        hook: parsed.hook,
        body: [parsed.introduction, parsed.product, parsed.benefits].filter(Boolean).join('\n'),
        cta: parsed.cta,
        rawText: result.text,
      },
    });
    const sceneRows = parsed.scenes?.length
      ? parsed.scenes
      : [
          { order: 1, role: 'HOOK', durationSec: 5, voiceover: parsed.hook, visual: '' },
          { order: 2, role: 'PROBLEM', durationSec: 5, voiceover: parsed.introduction, visual: '' },
          { order: 3, role: 'PRODUCT', durationSec: 8, voiceover: parsed.product, visual: '' },
          { order: 4, role: 'BENEFIT', durationSec: 7, voiceover: parsed.benefits, visual: '' },
          { order: 5, role: 'CTA', durationSec: 5, voiceover: parsed.cta, visual: '' },
        ];
    await this.prisma.creativeScriptScene.createMany({
      data: sceneRows.map((s, i) => ({
        teamId,
        userId: ownerId,
        scriptId: script.id,
        position: s.order || i,
        voiceover: s.voiceover,
        visual: s.visual,
        camera: s.camera,
        metadata: { role: s.role } as never,
      })),
    });
    await this.prisma.creativeVideoScene.deleteMany({ where: { projectId } });
    for (const s of sceneRows) {
      await this.prisma.creativeVideoScene.create({
        data: {
          teamId,
          userId: ownerId,
          projectId,
          order: s.order || 0,
          durationSec: s.durationSec || 5,
          role: s.role,
          script: s.voiceover,
          camera: s.camera,
          visualInstructions: s.visual,
        },
      });
    }
    return this.getProject(teamId, projectId);
  }

  async generateCaptions(teamId: string, userId: string | undefined, projectId: string, language = 'ar') {
    const ownerId = this.requireUserId(userId);
    const project = await this.getProject(teamId, projectId);
    const tracks = [];
    for (const scene of project.scenes) {
      const cues = captionsFromScript(scene.script || '', scene.durationSec || 5, language);
      tracks.push(
        await this.prisma.creativeCaptionTrack.create({
          data: {
            teamId,
            userId: ownerId,
            projectId,
            sceneId: scene.id,
            language,
            cues: cues as never,
            style: { fontSize: 42, position: 'bottom', background: true, rtl: language.startsWith('ar') } as never,
          },
        }),
      );
    }
    return tracks;
  }

  async recommendMusic(teamId: string, projectId: string, mood?: string) {
    await this.getProject(teamId, projectId);
    const licensed = await this.prisma.creativeMusicTrack.findMany({
      where: { teamId, licenseConfirmed: true, storageKey: { not: null } },
    });
    if (!licensed.length) {
      return { status: 'MUSIC_NOT_CONFIGURED', tracks: [], mood };
    }
    const matched = mood ? licensed.filter((t) => (t.mood || '').toLowerCase().includes(mood.toLowerCase())) : licensed;
    return { status: 'OK', tracks: matched.length ? matched : licensed };
  }

  async uploadMusic(
    teamId: string,
    userId: string | undefined,
    file: UploadedMediaFile,
    meta: { name: string; mood?: string; licenseConfirmed?: boolean; licenseNote?: string },
  ) {
    if (!meta.licenseConfirmed) {
      throw new ProviderError(MUSIC_NOT_CONFIGURED, 'يجب تأكيد حقوق استخدام الملف الموسيقي.', 400);
    }
    const stored = await this.storage.putMedia(teamId, file);
    return this.prisma.creativeMusicTrack.create({
      data: {
        teamId,
        userId: this.requireUserId(userId),
        name: meta.name,
        title: meta.name,
        mood: meta.mood,
        licenseConfirmed: true,
        licenseNote: meta.licenseNote,
        license: 'user-upload-confirmed',
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
      },
    });
  }

  async upsertContinuity(teamId: string, userId: string | undefined, projectId: string, data: Record<string, string | undefined>) {
    await this.getProject(teamId, projectId);
    const ownerId = this.requireUserId(userId);
    return this.prisma.creativeContinuityProfile.upsert({
      where: { projectId },
      create: { teamId, userId: ownerId, projectId, ...data },
      update: data,
    });
  }

  async listVersions(teamId: string, projectId: string) {
    await this.getProject(teamId, projectId);
    return this.prisma.creativeVideoVersion.findMany({ where: { teamId, projectId }, orderBy: { version: 'desc' } });
  }

  async setCurrentVersion(teamId: string, versionId: string) {
    const version = await this.prisma.creativeVideoVersion.findFirst({ where: { id: versionId, teamId } });
    if (!version) throw new NotFoundException('Version not found');
    await this.prisma.creativeVideoVersion.updateMany({ where: { projectId: version.projectId }, data: { isCurrent: false } });
    return this.prisma.creativeVideoVersion.update({ where: { id: versionId }, data: { isCurrent: true } });
  }

  async restoreVersion(teamId: string, userId: string | undefined, versionId: string) {
    const version = await this.prisma.creativeVideoVersion.findFirst({ where: { id: versionId, teamId } });
    if (!version) throw new NotFoundException('Version not found');
    const current = await this.prisma.creativeVideoVersion.findFirst({
      where: { projectId: version.projectId, isCurrent: true },
    });
    await this.prisma.creativeVideoVersion.updateMany({ where: { projectId: version.projectId }, data: { isCurrent: false } });
    return this.prisma.creativeVideoVersion.create({
      data: {
        teamId,
        userId: this.requireUserId(userId),
        projectId: version.projectId,
        jobId: version.jobId,
        assetId: version.assetId,
        parentVersionId: current?.id || version.id,
        version: (current?.version || version.version) + 1,
        label: `restore-v${version.version}`,
        isCurrent: true,
        snapshot: version.snapshot as never,
      },
    });
  }

  async deleteVersion(teamId: string, versionId: string) {
    const version = await this.prisma.creativeVideoVersion.findFirst({ where: { id: versionId, teamId } });
    if (!version) throw new NotFoundException('Version not found');
    if (version.isCurrent) throw new BadRequestException('لا يمكن حذف الإصدار الحالي.');
    await this.prisma.creativeVideoVersion.delete({ where: { id: versionId } });
    return { ok: true };
  }

  async director(teamId: string, userId: string | undefined, projectId: string, command: string) {
    const ownerId = this.requireUserId(userId);
    await this.getProject(teamId, projectId);
    if (!this.openai.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ للمخرج الإبداعي.', 503);
    const result = await this.openai.completeText({
      model: this.registry.openaiTextModel(),
      json: true,
      system: `Convert an advertising director command into JSON configuration.
Keys: durationSec, aspectRatio, sceneCount, model, environment, visualStyle, voice, musicMood, locale, assumptions[], missing[], scenes:[{order,role,environment,notes}].
Do not invent product medical claims. If Iraqi dialect is requested, set locale ar-IQ and voice.dialect iraqi (capability may be unavailable).
Surface assumptions in assumptions[].`,
      user: command,
    });
    const config = parseModelJson<Record<string, unknown>>(result.text);
    await this.prisma.creativeProject.update({
      where: { id: projectId },
      data: {
        durationSec: typeof config.durationSec === 'number' ? config.durationSec : undefined,
        aspectRatio: typeof config.aspectRatio === 'string' ? config.aspectRatio : undefined,
        locale: typeof config.locale === 'string' ? config.locale : undefined,
        metadata: { director: config, command } as never,
      },
    });
    return { config, command, savedBy: ownerId };
  }

  async applyEditPlan(teamId: string, userId: string | undefined, projectId: string, instruction: string) {
    const parsed = await this.parseEdit(teamId, userId, projectId, instruction);
    const plan = parsed.parsedPlan as ReturnType<typeof parseEditIntent>;
    if (plan.action === 'DELETE_LAST_SCENE') {
      const last = await this.prisma.creativeVideoScene.findFirst({ where: { teamId, projectId }, orderBy: { order: 'desc' } });
      if (last) await this.prisma.creativeVideoScene.delete({ where: { id: last.id } });
      return { parsed: plan, applied: 'DELETE_LAST_SCENE' };
    }
    if (plan.changeMap.dialect === 'iraqi') {
      return { parsed: plan, status: IRAQI_TTS_NOT_CONFIGURED };
    }
    if (plan.targetType === 'MUSIC') {
      const rec = await this.recommendMusic(teamId, projectId, plan.changeMap.music);
      return { parsed: plan, music: rec };
    }
    if (plan.action === 'SHORTEN' && plan.sceneIndex) {
      const scene = await this.prisma.creativeVideoScene.findFirst({
        where: { teamId, projectId, order: plan.sceneIndex },
      });
      if (scene) {
        await this.prisma.creativeVideoScene.update({
          where: { id: scene.id },
          data: { durationSec: Math.max(2, (scene.durationSec || 5) * 0.7) },
        });
      }
      return { parsed: plan, applied: 'SHORTEN' };
    }
    return { parsed: plan, applied: 'PLAN_ONLY' };
  }
}
