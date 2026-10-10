import { NotFoundException } from '@nestjs/common';
import { CreativeJobStatus, CreativeJobType } from '@watsapp/database';
import { CreativeStudioService } from './creative-studio.service';
import { PROVIDER_NOT_CONFIGURED } from './providers/provider-error';

describe('CreativeStudioService', () => {
  const queue = { add: jest.fn() };
  const storage = { putMedia: jest.fn(), remove: jest.fn() };
  const entitlements = {
    assertCreativeStudioEnabled: jest.fn().mockResolvedValue({
      limits: { creative4kEnabled: false, creativeImagesLimit: -1, creativeVideoSecondsLimit: -1 },
    }),
  };
  const openai = { isConfigured: jest.fn(), authenticate: jest.fn() };
  const openrouter = { isConfigured: jest.fn(), authenticate: jest.fn() };
  const gemini = { isConfigured: jest.fn(), authenticate: jest.fn() };
  const registry = { snapshot: jest.fn() };
  const intelligence = {};
  const generation = { process: jest.fn(), retryable: jest.fn().mockReturnValue(false) };

  function prismaMock() {
    return {
      creativeProject: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      creativeGenerationJob: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      creativeUsageRecord: {
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        $executeRaw: jest.fn(),
        creativeUsageRecord: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { durationSec: 0 } }) },
        creativeGenerationJob: { count: jest.fn().mockResolvedValue(0) },
      })),
      aiCostEvent: { create: jest.fn() },
    };
  }

  const iraqiTts = { isConfigured: () => false, synthesize: jest.fn() };
  const lipSync = { isConfigured: () => false };
  const upscale = { isConfigured: () => false };
  const music = { isConfigured: () => false, recommend: jest.fn() };

  function service(prisma = prismaMock()) {
    const instance = new CreativeStudioService(
      prisma as never,
      entitlements as never,
      openai as never,
      openrouter as never,
      gemini as never,
      registry as never,
      intelligence as never,
      generation as never,
      iraqiTts as never,
      lipSync as never,
      upscale as never,
      music as never,
      storage as never,
      queue as never,
    );
    return { prisma, instance };
  }

  beforeEach(() => {
    queue.add.mockReset();
    entitlements.assertCreativeStudioEnabled.mockResolvedValue(undefined);
    openai.isConfigured.mockReturnValue(true);
    openrouter.isConfigured.mockReturnValue(false);
    gemini.isConfigured.mockReturnValue(false);
    openai.authenticate.mockResolvedValue({ ok: true, provider: 'openai', modelsSample: ['gpt-4o'] });
  });

  it('isolates projects by teamId', async () => {
    const { instance, prisma } = service();
    prisma.creativeProject.findFirst.mockResolvedValue(null);
    await expect(instance.getProject('team-b', 'proj-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.creativeProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'proj-1', teamId: 'team-b' } }),
    );
  });

  it('returns the existing job for the same idempotency key', async () => {
    const { instance, prisma } = service();
    prisma.creativeProject.findFirst.mockResolvedValue({ id: 'proj-1', assets: [] });
    prisma.creativeGenerationJob.findFirst.mockResolvedValue({ id: 'job-1', teamId: 'team-a' });
    const result = await instance.createJob('team-a', 'user-a', {
      projectId: 'proj-1',
      type: 'PROBE',
      idempotencyKey: 'probe-1',
    });
    expect(result.id).toBe('job-1');
    expect(prisma.creativeGenerationJob.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('fails without queuing when the provider key is missing', async () => {
    openai.isConfigured.mockReturnValue(false);
    const { instance, prisma } = service();
    prisma.creativeProject.findFirst.mockResolvedValue({ id: 'proj-1', assets: [] });
    prisma.creativeGenerationJob.findFirst.mockResolvedValue(null);
    prisma.creativeGenerationJob.create.mockResolvedValue({
      id: 'job-2',
      status: CreativeJobStatus.FAILED,
      provider: 'openai',
    });
    const job = await instance.createJob('team-a', 'user-a', { projectId: 'proj-1', type: 'PROBE', provider: 'openai' });
    expect(job.status).toBe(CreativeJobStatus.FAILED);
    expect(prisma.creativeGenerationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: PROVIDER_NOT_CONFIGURED, status: CreativeJobStatus.FAILED }),
      }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues probe jobs when OpenAI is configured', async () => {
    const { instance, prisma } = service();
    prisma.creativeProject.findFirst.mockResolvedValue({ id: 'proj-1', assets: [] });
    prisma.creativeGenerationJob.findFirst.mockResolvedValue(null);
    prisma.creativeGenerationJob.create.mockResolvedValue({
      id: 'job-3',
      status: CreativeJobStatus.QUEUED,
    });
    await instance.createJob('team-a', 'user-a', { projectId: 'proj-1', type: 'PROBE', provider: 'openai' });
    expect(queue.add).toHaveBeenCalledWith(
      'run',
      { generationJobId: 'job-3', teamId: 'team-a' },
      expect.objectContaining({ jobId: 'creative:job-3', attempts: 5 }),
    );
  });

  it('authenticates OpenAI for probe jobs and records usage', async () => {
    const { instance, prisma } = service();
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'job-3',
      teamId: 'team-a',
      provider: 'openai',
      type: CreativeJobType.PROBE,
      status: CreativeJobStatus.QUEUED,
      model: null,
      startedAt: null,
    });
    prisma.creativeGenerationJob.update.mockResolvedValue({});
    await instance.processQueuedJob('job-3');
    expect(openai.authenticate).toHaveBeenCalled();
    expect(prisma.creativeGenerationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CreativeJobStatus.SUCCEEDED }),
      }),
    );
    expect(prisma.aiCostEvent.create).toHaveBeenCalled();
  });

  it('runs real image generation through the generation service instead of faking success', async () => {
    const { instance, prisma } = service();
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'job-img',
      teamId: 'team-a',
      provider: 'openrouter',
      type: CreativeJobType.IMAGE,
      status: CreativeJobStatus.QUEUED,
      startedAt: null,
    });
    prisma.creativeGenerationJob.update.mockResolvedValue({});
    await instance.processQueuedJob('job-img');
    expect(generation.process).toHaveBeenCalledWith('job-img');
  });

  it('isolates generated jobs by teamId (IDOR)', async () => {
    const { instance, prisma } = service();
    prisma.creativeGenerationJob.findFirst.mockResolvedValue(null);
    await expect(instance.getJob('team-b', 'job-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.creativeGenerationJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-a', teamId: 'team-b' } }),
    );
  });
});
