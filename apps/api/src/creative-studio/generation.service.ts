import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreativeAssetKind, CreativeJobStatus, CreativeJobType, Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { CREATIVE_STORAGE, type StorageProvider } from '../storage/storage-provider';
import { parseEditIntent } from './edit-intent';
import { parseModelJson } from './json';
import { buildImagePrompt } from './prompt-builder';
import { describeResolution, isFourKRequest } from './resolution';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { GeminiProvider } from './providers/gemini.provider';
import {
  CAPABILITY_NOT_SUPPORTED,
  DOWNLOAD_FAILED,
  FFMPEG_NOT_AVAILABLE,
  FOUR_K_NOT_ENABLED,
  FOUR_K_UPSCALE_NOT_CONFIGURED,
  GENERATION_FAILED,
  IRAQI_TTS_NOT_CONFIGURED,
  LIPSYNC_NOT_CONFIGURED,
  PROVIDER_NOT_CONFIGURED,
  PROVIDER_RATE_LIMITED,
  PROVIDER_TIMEOUT,
  ProviderError,
  STORAGE_FAILED,
} from './providers/provider-error';
import { ProviderRegistry } from './providers/provider-registry';
import { IraqiTTSProvider, LipSyncProvider, UpscaleProvider } from './providers/future.providers';
import { FfmpegComposeService } from './ffmpeg.service';

const VIDEO_POLL_MS = 8_000;
const VIDEO_TIMEOUT_MS = 12 * 60 * 1000;

@Injectable()
export class CreativeGenerationService {
  private readonly logger = new Logger(CreativeGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly gemini: GeminiProvider,
    private readonly registry: ProviderRegistry,
    @Inject(CREATIVE_STORAGE) private readonly storage: StorageProvider,
    private readonly ffmpeg: FfmpegComposeService,
    private readonly iraqiTts: IraqiTTSProvider,
    private readonly lipSync: LipSyncProvider,
    private readonly upscale: UpscaleProvider,
  ) {}

  async process(jobId: string) {
    const job = await this.prisma.creativeGenerationJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === CreativeJobStatus.CANCELLED || job.status === CreativeJobStatus.SUCCEEDED) return;
    if (job.type === CreativeJobType.PROBE) return 'probe';
    if (job.type === CreativeJobType.IMAGE || job.type === CreativeJobType.EDIT) {
      await this.runImage(job.id);
      return;
    }
    if (job.type === CreativeJobType.VIDEO) {
      await this.runVideo(job.id);
      return;
    }
    if (job.type === CreativeJobType.TTS) {
      await this.runTts(job.id);
      return;
    }
    if (job.type === CreativeJobType.LIPSYNC) {
      throw new ProviderError(LIPSYNC_NOT_CONFIGURED, 'Lip-sync is not configured.', 501);
    }
    if (job.type === CreativeJobType.UPSCALE) {
      throw new ProviderError(FOUR_K_UPSCALE_NOT_CONFIGURED, '4K upscaling is not configured.', 501);
    }
    if (job.type === CreativeJobType.COMPOSE) {
      await this.runCompose(job.id);
      return;
    }
    throw new ProviderError(CAPABILITY_NOT_SUPPORTED, 'هذا النوع من التوليد غير مفعّل بعد.', 501);
  }

  private async runImage(jobId: string) {
    const job = await this.loadJob(jobId);
    const payload = (job.payload || {}) as Record<string, unknown>;
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: job.projectId, teamId: job.teamId },
      include: { productProfile: true, assets: true, briefs: true, concepts: true },
    });
    if (!project) throw new ProviderError(GENERATION_FAILED, 'المشروع غير موجود.', 404);

    const selectedConcept = project.concepts.find((c) => c.selected) || project.concepts.find((c) => c.id === payload.conceptId);
    const brief = project.briefs[0];
    const refsWanted = project.assets.length > 0;
    const chosen = await this.registry.selectModel({
      capability: 'imageGeneration',
      provider: job.provider === 'openai' || job.provider === 'openrouter' || job.provider === 'gemini' ? job.provider : undefined,
      model: job.model || undefined,
      aspectRatio: String(payload.aspectRatio || project.aspectRatio || ''),
      resolution: payload.resolution ? String(payload.resolution) : undefined,
      requireReference: refsWanted && job.provider !== 'openai',
    });

    if (refsWanted && !chosen.capabilities.referenceImage) {
      throw new ProviderError(
        CAPABILITY_NOT_SUPPORTED,
        'النموذج المختار لا يدعم صور المنتج المرجعية. لن نولّد من النص فقط عندما تكون صور المنتج مطلوبة.',
        400,
      );
    }

    const edit = payload.instruction ? parseEditIntent(String(payload.instruction)) : null;
    const { providerPrompt, userVisible } = buildImagePrompt({
      productName: project.productProfile?.name || project.name,
      productFacts: JSON.stringify({
        description: project.productProfile?.description,
        userClaims: project.productProfile?.userClaims,
        intelligence: project.productProfile?.intelligence,
      }),
      brief: brief ? (brief as unknown as Record<string, unknown>) : null,
      concept: selectedConcept?.payload as Record<string, unknown> | undefined,
      modelProfile: (payload.modelProfile as Record<string, unknown>) || null,
      userInstructions: String(payload.instruction || payload.userInstructions || ''),
      variation: edit ? { preserve: edit.preserve, changes: edit.changes } : undefined,
      internalConstraints: 'Do not add unverified medical or legal claims. Preserve product identity.',
    });

    await this.setStatus(job.id, CreativeJobStatus.PROVIDER_SUBMITTED, { selectedModel: chosen.model, userVisible });

    const referenceUrls = refsWanted && chosen.capabilities.referenceImage ? await this.referenceDataUrls(project.assets) : [];
    const handle = await this.imageProvider(chosen.provider).createImageJob({
      model: chosen.model,
      prompt: providerPrompt,
      aspectRatio: String(payload.aspectRatio || project.aspectRatio || ''),
      resolution: payload.resolution ? String(payload.resolution) : undefined,
      referenceImageUrls: referenceUrls,
    });

    await this.prisma.creativeGenerationJob.update({
      where: { id: job.id },
      data: { providerJobId: handle.providerJobId, provider: chosen.provider, model: chosen.model },
    });

    await this.setStatus(job.id, CreativeJobStatus.DOWNLOADING);
    const result = await this.imageProvider(chosen.provider).getGenerationResult(handle.providerJobId);
    await this.persistMedia(job, result, chosen.provider, chosen.model, String(payload.resolution || ''), 'image');
  }

  private async runVideo(jobId: string) {
    const job = await this.loadJob(jobId);
    if (!this.gemini.isConfigured() && !this.openrouter.isConfigured()) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'لا يوجد مزود فيديو معدّ (Gemini / OpenRouter).', 503);
    }
    const payload = (job.payload || {}) as Record<string, unknown>;
    const mode = String(payload.videoMode || 'text');
    const capability = mode === 'image' ? 'imageToVideo' : 'textToVideo';
    const preferredProvider =
      job.provider === 'gemini' || job.provider === 'openrouter'
        ? job.provider
        : this.gemini.isConfigured()
          ? 'gemini'
          : 'openrouter';
    const chosen = await this.registry.selectModel({
      capability,
      provider: preferredProvider,
      model: job.model || undefined,
      aspectRatio: payload.aspectRatio ? String(payload.aspectRatio) : undefined,
      resolution: payload.resolution ? String(payload.resolution) : undefined,
      durationSec: payload.durationSec ? Number(payload.durationSec) : undefined,
      requireReference: mode === 'reference',
    });
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: job.projectId, teamId: job.teamId },
      include: { productProfile: true, assets: true, briefs: true, concepts: true },
    });
    const prompt = `Photorealistic product video. Product: ${project?.productProfile?.name || project?.name}. Do not invent claims.`;
    const frames = mode === 'image' && project?.assets.length ? await this.referenceDataUrls(project.assets.slice(0, 1)) : [];
    await this.setStatus(job.id, CreativeJobStatus.PROVIDER_SUBMITTED);
    const videoProvider = this.videoProvider(chosen.provider);
    const handle = await videoProvider.createVideoJob({
      model: chosen.model,
      prompt,
      durationSec: payload.durationSec ? Number(payload.durationSec) : undefined,
      aspectRatio: payload.aspectRatio ? String(payload.aspectRatio) : undefined,
      resolution: payload.resolution ? String(payload.resolution) : undefined,
      frameImageUrls: frames,
    });
    await this.prisma.creativeGenerationJob.update({
      where: { id: job.id },
      data: { providerJobId: handle.providerJobId, provider: chosen.provider, model: chosen.model },
    });
    await this.setStatus(job.id, CreativeJobStatus.POLLING);
    const started = Date.now();
    let status = await videoProvider.getGenerationStatus(handle.providerJobId);
    while (status.status === 'pending' || status.status === 'in_progress') {
      if (Date.now() - started > VIDEO_TIMEOUT_MS) {
        throw new ProviderError(PROVIDER_TIMEOUT, 'انتهت مهلة انتظار فيديو المزود.', 504);
      }
      await new Promise((r) => setTimeout(r, VIDEO_POLL_MS));
      status = await videoProvider.getGenerationStatus(handle.providerJobId);
    }
    if (status.status !== 'completed') {
      throw new ProviderError(GENERATION_FAILED, status.error || 'فشل توليد الفيديو لدى المزود.', 502);
    }
    await this.setStatus(job.id, CreativeJobStatus.DOWNLOADING);
    let result;
    try {
      result = await videoProvider.getGenerationResult(handle.providerJobId);
    } catch {
      throw new ProviderError(DOWNLOAD_FAILED, 'تعذر تنزيل فيديو المزود.', 502);
    }
    await this.persistMedia(job, result, chosen.provider, chosen.model, String(payload.resolution || ''), 'video', status.costUsd);
  }

  private async runTts(jobId: string) {
    const job = await this.loadJob(jobId);
    const payload = (job.payload || {}) as Record<string, unknown>;
    const dialect = String(payload.dialect || payload.language || '').toLowerCase();
    const wantsIraqi = dialect.includes('iraqi') || dialect === 'ar-iq' || Boolean(payload.iraqi);
    if (wantsIraqi) {
      await this.iraqiTts.synthesize();
    }
    if (!this.openai.isConfigured()) {
      throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ للصوت. اللهجة العراقية غير متوفرة.', 503);
    }
    const text = String(payload.script || payload.instruction || '').trim();
    if (!text) throw new ProviderError(GENERATION_FAILED, 'لا يوجد نص للتعليق الصوتي.', 400);
    await this.setStatus(job.id, CreativeJobStatus.PROVIDER_SUBMITTED);
    const audio = await this.openai.synthesize({
      text,
      voice: payload.voice ? String(payload.voice) : undefined,
      gender: payload.gender ? String(payload.gender) : undefined,
      language: String(payload.language || 'ar'),
      dialect: 'msa',
      speed: payload.speed ? Number(payload.speed) : undefined,
    });
    await this.persistMedia(job, audio, 'openai', 'tts-1', '', 'audio');
    if (job.sceneId) {
      const asset = await this.prisma.creativeGenerationAsset.findFirst({ where: { jobId: job.id } });
      if (asset) {
        await this.prisma.creativeVideoScene.update({
          where: { id: job.sceneId },
          data: { voiceAssetId: asset.id, generationJobId: job.id },
        });
      }
    }
  }

  private async runCompose(jobId: string) {
    const job = await this.loadJob(jobId);
    const payload = (job.payload || {}) as Record<string, unknown>;
    const project = await this.prisma.creativeProject.findFirst({
      where: { id: job.projectId, teamId: job.teamId },
      include: { scenes: { orderBy: { order: 'asc' } }, captionTracks: true },
    });
    if (!project?.scenes.length) {
      throw new ProviderError(GENERATION_FAILED, 'لا توجد مشاهد للتركيب.', 400);
    }
    await this.ffmpeg.assertAvailable();
    const { mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { randomUUID } = await import('node:crypto');
    const workDir = join(tmpdir(), `compose-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    try {
      const clips = [];
      for (const scene of project.scenes) {
        const imageKey = scene.imageAssetId
          ? (await this.prisma.creativeGenerationAsset.findFirst({ where: { id: scene.imageAssetId, teamId: job.teamId } }))?.storageKey
          : null;
        const videoKey = scene.videoAssetId
          ? (await this.prisma.creativeGenerationAsset.findFirst({ where: { id: scene.videoAssetId, teamId: job.teamId } }))?.storageKey
          : null;
        const voiceKey = scene.voiceAssetId
          ? (await this.prisma.creativeGenerationAsset.findFirst({ where: { id: scene.voiceAssetId, teamId: job.teamId } }))?.storageKey
          : null;
        if (!imageKey && !videoKey) {
          throw new ProviderError(GENERATION_FAILED, `المشهد ${scene.order} بلا وسائط.`, 400);
        }
        const imagePath = imageKey ? await this.materialize(workDir, `s${scene.order}.img`, imageKey) : undefined;
        const videoPath = videoKey ? await this.materialize(workDir, `s${scene.order}.vid`, videoKey) : undefined;
        const audioPath = voiceKey ? await this.materialize(workDir, `s${scene.order}.mp3`, voiceKey) : undefined;
        clips.push({ videoPath, imagePath, audioPath, durationSec: scene.durationSec || 5 });
      }
      const musicId = payload.musicTrackId ? String(payload.musicTrackId) : project.scenes.find((s) => s.musicTrackId)?.musicTrackId;
      let musicPath: string | undefined;
      if (musicId) {
        const track = await this.prisma.creativeMusicTrack.findFirst({ where: { id: musicId, teamId: job.teamId, licenseConfirmed: true } });
        if (track?.storageKey) musicPath = await this.materialize(workDir, 'music.bin', track.storageKey);
      }
      const aspect = (String(payload.aspectRatio || project.aspectRatio || '16:9') as '16:9' | '9:16' | '1:1');
      const composed = await this.ffmpeg.composeFinal({
        clips,
        musicPath,
        aspect: aspect === '9:16' || aspect === '1:1' ? aspect : '16:9',
        levels: { voice: 1, music: 0.15 },
      });
      await this.persistMedia(job, { buffer: composed.buffer, mimeType: composed.mimeType }, 'ffmpeg', 'ffmpeg-compose', String(payload.resolution || ''), 'video');
      await this.ffmpeg.cleanup(composed.workDir);
      await this.createVersion(job, 'compose');
    } finally {
      await this.ffmpeg.cleanup(workDir);
    }
  }

  private async materialize(workDir: string, name: string, storageKey: string) {
    const buf = await this.storage.readBuffer(storageKey);
    return this.ffmpeg.writeTempFile(workDir, name, buf);
  }

  private async createVersion(job: { id: string; teamId: string; userId: string; projectId: string }, label: string) {
    const last = await this.prisma.creativeVideoVersion.findFirst({
      where: { projectId: job.projectId },
      orderBy: { version: 'desc' },
    });
    const asset = await this.prisma.creativeGenerationAsset.findFirst({ where: { jobId: job.id } });
    const scenes = await this.prisma.creativeVideoScene.findMany({ where: { projectId: job.projectId }, orderBy: { order: 'asc' } });
    await this.prisma.creativeVideoVersion.updateMany({ where: { projectId: job.projectId, isCurrent: true }, data: { isCurrent: false } });
    await this.prisma.creativeVideoVersion.create({
      data: {
        teamId: job.teamId,
        userId: job.userId,
        projectId: job.projectId,
        jobId: job.id,
        assetId: asset?.id,
        parentVersionId: last?.id,
        version: (last?.version || 0) + 1,
        label,
        isCurrent: true,
        snapshot: { scenes: scenes.map((s) => ({ id: s.id, order: s.order, script: s.script })) } as Prisma.InputJsonValue,
      },
    });
  }

  private imageProvider(provider: string) {
    if (provider === 'gemini') {
      if (!this.gemini.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Gemini غير معدّ.', 503);
      return this.gemini;
    }
    if (provider === 'openai') {
      if (!this.openai.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenAI غير معدّ.', 503);
      return this.openai;
    }
    if (!this.openrouter.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenRouter غير معدّ.', 503);
    return this.openrouter;
  }

  private videoProvider(provider: string) {
    if (provider === 'gemini') {
      if (!this.gemini.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'Gemini غير معدّ للفيديو.', 503);
      return this.gemini;
    }
    if (!this.openrouter.isConfigured()) throw new ProviderError(PROVIDER_NOT_CONFIGURED, 'OpenRouter غير معدّ للفيديو.', 503);
    return this.openrouter;
  }

  private async persistMedia(
    job: { id: string; teamId: string; userId: string; projectId: string; type: CreativeJobType },
    result: { buffer: Buffer; mimeType: string; width?: number; height?: number; durationSec?: number },
    provider: string,
    model: string,
    requestedResolution: string,
    mediaType: 'image' | 'video' | 'audio',
    costUsd?: number,
  ) {
    await this.setStatus(job.id, CreativeJobStatus.STORING);
    let stored;
    try {
      stored = await this.storage.putBuffer(
        job.teamId,
        result.buffer,
        result.mimeType,
        mediaType === 'video' ? 'gen.mp4' : mediaType === 'audio' ? 'voice.mp3' : 'gen.png',
      );
    } catch (error) {
      this.logger.warn(JSON.stringify({ event: 'STORAGE_FAILED', jobId: job.id }));
      throw new ProviderError(STORAGE_FAILED, 'تعذر حفظ الملف المولَّد.', 500);
    }
    const dims = describeResolution(requestedResolution, result.width, result.height);
    await this.prisma.creativeGenerationAsset.create({
      data: {
        teamId: job.teamId,
        userId: job.userId,
        jobId: job.id,
        projectId: job.projectId,
        kind:
          mediaType === 'video'
            ? CreativeAssetKind.VIDEO
            : mediaType === 'audio'
              ? CreativeAssetKind.AUDIO
              : CreativeAssetKind.GENERATED_IMAGE,
        storageKey: stored.storageKey,
        mimeType: result.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        width: result.width,
        height: result.height,
        durationSec: result.durationSec,
        provider,
        model,
        requestedResolution: dims.requestedResolution,
        actualResolution: dims.actualResolution,
        resolutionType: dims.resolutionType,
        metadata: { isNative4k: dims.isNative4k } as Prisma.InputJsonValue,
      },
    });
    await this.setStatus(job.id, CreativeJobStatus.QUALITY_CHECK);
    const quality = await this.qualityCheck(job, mediaType);
    await this.prisma.creativeQualityCheck.create({
      data: {
        teamId: job.teamId,
        userId: job.userId,
        jobId: job.id,
        passed: quality.status !== 'FAIL',
        score: quality.score,
        status: quality.status,
        findings: quality as Prisma.InputJsonValue,
      },
    });
    await this.prisma.creativeGenerationJob.update({
      where: { id: job.id },
      data: {
        status: CreativeJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        result: { storageKey: stored.storageKey, isNative4k: dims.isNative4k } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.creativeUsageRecord.updateMany({
      where: { jobId: job.id },
      data: {
        status: 'SUCCEEDED',
        model,
        mediaType,
        resolution: dims.actualResolution,
        actualCost: costUsd,
        costStatus: costUsd == null ? 'UNKNOWN' : 'ACTUAL',
        currency: costUsd == null ? null : 'USD',
        durationSec: result.durationSec,
      },
    });
    await this.prisma.aiCostEvent.create({
      data: {
        teamId: job.teamId,
        provider,
        model,
        operation: `creative.${mediaType}`,
        costCents: costUsd != null ? Math.round(costUsd * 100) : 0,
      },
    });
    await this.prisma.creativeProject.update({ where: { id: job.projectId }, data: { status: 'COMPLETED' } });
  }

  private async qualityCheck(job: { id: string; projectId: string; teamId: string }, mediaType: string) {
    const issues: Array<{ type: string; severity: string }> = [];
    if (mediaType === 'audio') {
      return { status: 'OK', score: 1, issues, method: 'audio-presence' };
    }
    if (mediaType === 'video') {
      const asset = await this.prisma.creativeGenerationAsset.findFirst({ where: { jobId: job.id } });
      if (!asset) issues.push({ type: 'MISSING_ASSET', severity: 'HIGH' });
      if (asset && !asset.durationSec) issues.push({ type: 'DURATION_UNKNOWN', severity: 'LOW' });
      return {
        status: issues.some((i) => i.severity === 'HIGH') ? 'WARNING' : 'OK',
        score: issues.length ? 0.8 : 0.9,
        issues,
        method: 'heuristic-video',
      };
    }
    if (!this.openai.isConfigured()) {
      return { status: 'OK', score: null as number | null, issues, method: 'skipped' };
    }
    try {
      const asset = await this.prisma.creativeGenerationAsset.findFirst({ where: { jobId: job.id } });
      const project = await this.prisma.creativeProject.findFirst({
        where: { id: job.projectId },
        include: { productProfile: true },
      });
      if (!asset) return { status: 'OK', score: null, issues, method: 'skipped' };
      const buf = await this.storage.readBuffer(asset.storageKey);
      const result = await this.openai.completeText({
        model: this.registry.openaiTextModel(),
        system: 'Return JSON {score:0-100, issues:[], warnings:[], productVisible:boolean, distorted:boolean}. Do not reject unless the product is missing or unrecognizable.',
        user: `Compare generated image to product ${project?.productProfile?.name}`,
        images: [{ mimeType: asset.mimeType, dataBase64: buf.toString('base64') }],
        json: true,
      });
      const parsed = parseModelJson<{
        score?: number;
        issues?: string[];
        warnings?: string[];
        productVisible?: boolean;
        distorted?: boolean;
      }>(result.text);
      if (parsed.productVisible === false) issues.push({ type: 'MISSING_PRODUCT', severity: 'HIGH' });
      if (parsed.distorted) issues.push({ type: 'TEXT_DISTORTION', severity: 'LOW' });
      const score = typeof parsed.score === 'number' ? parsed.score / 100 : 0.7;
      return {
        status: parsed.productVisible === false ? 'WARNING' : issues.length ? 'WARNING' : 'OK',
        score,
        issues: [...issues, ...(parsed.issues || []).map((type) => ({ type, severity: 'LOW' }))],
        method: 'openai-vision',
      };
    } catch {
      return { status: 'OK', score: null, issues, method: 'skipped' };
    }
  }

  private async referenceDataUrls(assets: Array<{ storageKey: string; mimeType: string }>) {
    const urls: string[] = [];
    for (const asset of assets.slice(0, 3)) {
      const buf = await this.storage.readBuffer(asset.storageKey);
      urls.push(`data:${asset.mimeType};base64,${buf.toString('base64')}`);
    }
    return urls;
  }

  private async setStatus(id: string, status: CreativeJobStatus, extra?: Record<string, unknown>) {
    await this.prisma.creativeGenerationJob.update({
      where: { id },
      data: {
        status,
        ...(extra ? { result: extra as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private loadJob(id: string) {
    return this.prisma.creativeGenerationJob.findUniqueOrThrow({ where: { id } });
  }

  assertFourKAllowed(enabled: boolean, resolution?: string) {
    if (isFourKRequest(resolution) && !enabled) {
      throw new ProviderError(FOUR_K_NOT_ENABLED, 'توليد 4K غير مضمّن في باقتك.', 403);
    }
  }

  retryable(error: unknown) {
    return (
      error instanceof ProviderError &&
      (error.code === PROVIDER_RATE_LIMITED || error.code === PROVIDER_TIMEOUT)
    );
  }
}
