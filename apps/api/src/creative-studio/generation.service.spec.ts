import { CreativeJobStatus, CreativeJobType } from '@watsapp/database';
import { CreativeGenerationService } from './generation.service';
import { CAPABILITY_NOT_SUPPORTED, PROVIDER_NOT_CONFIGURED } from './providers/provider-error';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('CreativeGenerationService', () => {
  const prisma = {
    creativeGenerationJob: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    creativeProject: { findFirst: jest.fn(), update: jest.fn() },
    creativeGenerationAsset: { create: jest.fn(), findFirst: jest.fn() },
    creativeQualityCheck: { create: jest.fn() },
    creativeUsageRecord: { updateMany: jest.fn() },
    aiCostEvent: { create: jest.fn() },
  };
  const openai = { isConfigured: jest.fn().mockReturnValue(false), completeText: jest.fn() };
  const openrouter = {
    isConfigured: jest.fn().mockReturnValue(true),
    createImageJob: jest.fn(),
    getGenerationResult: jest.fn(),
    createVideoJob: jest.fn(),
    getGenerationStatus: jest.fn(),
  };
  const gemini = {
    isConfigured: jest.fn().mockReturnValue(false),
    createImageJob: jest.fn(),
    getGenerationResult: jest.fn(),
    createVideoJob: jest.fn(),
    getGenerationStatus: jest.fn(),
  };
  const registry = {
    selectModel: jest.fn(),
    openaiTextModel: () => 'gpt-4o',
  };
  const storage = {
    putBuffer: jest.fn(),
    readBuffer: jest.fn(),
  };

  function service() {
    return new CreativeGenerationService(
      prisma as never,
      openai as never,
      openrouter as never,
      gemini as never,
      registry as never,
      storage as never,
      { assertAvailable: jest.fn(), composeFinal: jest.fn(), cleanup: jest.fn(), writeTempFile: jest.fn() } as never,
      { synthesize: jest.fn() } as never,
      { createLipSyncJob: jest.fn() } as never,
      { upscale: jest.fn() } as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.creativeGenerationJob.update.mockResolvedValue({});
    prisma.creativeProject.update.mockResolvedValue({});
    prisma.creativeUsageRecord.updateMany.mockResolvedValue({});
    prisma.aiCostEvent.create.mockResolvedValue({});
    prisma.creativeQualityCheck.create.mockResolvedValue({});
    prisma.creativeGenerationAsset.create.mockResolvedValue({ id: 'asset-1' });
    prisma.creativeGenerationAsset.findFirst.mockResolvedValue(null);
  });

  it('fails without a video provider when video is requested', async () => {
    openrouter.isConfigured.mockReturnValue(false);
    gemini.isConfigured.mockReturnValue(false);
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'v1',
      type: CreativeJobType.VIDEO,
      status: CreativeJobStatus.QUEUED,
    });
    prisma.creativeGenerationJob.findUniqueOrThrow.mockResolvedValue({
      id: 'v1',
      type: CreativeJobType.VIDEO,
      teamId: 't',
      userId: 'u',
      projectId: 'p',
      payload: {},
    });
    await expect(service().process('v1')).rejects.toMatchObject({ code: PROVIDER_NOT_CONFIGURED });
  });

  it('stores a real provider image buffer and records usage', async () => {
    openrouter.isConfigured.mockReturnValue(true);
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'img1',
      type: CreativeJobType.IMAGE,
      status: CreativeJobStatus.QUEUED,
    });
    prisma.creativeGenerationJob.findUniqueOrThrow.mockResolvedValue({
      id: 'img1',
      teamId: 'team-a',
      userId: 'user-a',
      projectId: 'proj-1',
      type: CreativeJobType.IMAGE,
      provider: 'openrouter',
      model: 'test/image',
      payload: { aspectRatio: '1:1' },
    });
    prisma.creativeProject.findFirst.mockResolvedValue({
      id: 'proj-1',
      name: 'Serum',
      aspectRatio: '1:1',
      productProfile: { name: 'Serum' },
      assets: [],
      briefs: [],
      concepts: [],
    });
    registry.selectModel.mockResolvedValue({
      provider: 'openrouter',
      model: 'test/image',
      capabilities: { imageGeneration: true, referenceImage: false },
    });
    openrouter.createImageJob.mockResolvedValue({ providerJobId: 'or-1', status: 'completed' });
    openrouter.getGenerationResult.mockResolvedValue({ buffer: PNG, mimeType: 'image/png', width: 1024, height: 1024 });
    storage.putBuffer.mockResolvedValue({ storageKey: 'media/team-a/x.png', checksum: 'abc', sizeBytes: PNG.length });

    await service().process('img1');
    expect(openrouter.createImageJob).toHaveBeenCalled();
    expect(storage.putBuffer).toHaveBeenCalledWith('team-a', PNG, 'image/png', 'gen.png');
    expect(prisma.creativeGenerationAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storageKey: 'media/team-a/x.png', resolutionType: 'NATIVE' }),
      }),
    );
    expect(prisma.creativeUsageRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ costStatus: 'UNKNOWN' }) }),
    );
  });

  it('refuses generation when reference images are required but unsupported', async () => {
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'img2',
      type: CreativeJobType.IMAGE,
      status: CreativeJobStatus.QUEUED,
    });
    prisma.creativeGenerationJob.findUniqueOrThrow.mockResolvedValue({
      id: 'img2',
      teamId: 'team-a',
      userId: 'user-a',
      projectId: 'proj-1',
      type: CreativeJobType.IMAGE,
      provider: 'openai',
      payload: {},
    });
    prisma.creativeProject.findFirst.mockResolvedValue({
      id: 'proj-1',
      name: 'Serum',
      productProfile: { name: 'Serum' },
      assets: [{ storageKey: 'a.jpg', mimeType: 'image/jpeg' }],
      briefs: [],
      concepts: [],
    });
    registry.selectModel.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-image-2',
      capabilities: { imageGeneration: true, referenceImage: false },
    });
    await expect(service().process('img2')).rejects.toMatchObject({ code: CAPABILITY_NOT_SUPPORTED });
    expect(openrouter.createImageJob).not.toHaveBeenCalled();
  });
});
