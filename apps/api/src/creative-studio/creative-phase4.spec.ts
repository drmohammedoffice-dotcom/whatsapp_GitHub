import { parseEditIntent } from './edit-intent';
import { captionsFromScript } from './captions';
import { CreativeGenerationService } from './generation.service';
import { IRAQI_TTS_NOT_CONFIGURED, LIPSYNC_NOT_CONFIGURED, FOUR_K_UPSCALE_NOT_CONFIGURED } from './providers/provider-error';
import { CreativeJobStatus, CreativeJobType } from '@watsapp/database';
import { IraqiTTSProvider } from './providers/future.providers';

describe('Phase 4 edit director', () => {
  it('targets scene 2 only for background change', () => {
    const parsed = parseEditIntent('غير الخلفية بالمشهد الثاني فقط');
    expect(parsed.sceneIndex).toBe(2);
    expect(parsed.regenerationScope).toBe('scene');
    expect(parsed.targetType).toBe('BACKGROUND');
    expect(parsed.preserve).toEqual(expect.arrayContaining(['product', 'model', 'voice', 'music', 'script']));
  });

  it('detects Iraqi dialect request without claiming TTS works', () => {
    const parsed = parseEditIntent('خلي الكلام باللهجة العراقية');
    expect(parsed.changeMap.dialect).toBe('iraqi');
    expect(parsed.targetType).toBe('VOICE');
  });

  it('deletes last scene', () => {
    expect(parseEditIntent('احذف المشهد الأخير').action).toBe('DELETE_LAST_SCENE');
  });
});

describe('captions', () => {
  it('splits Arabic script into timed cues without burning video', () => {
    const cues = captionsFromScript('هذا منتج تجميلي آمن للاستخدام اليومي', 10, 'ar');
    expect(cues.length).toBeGreaterThan(0);
    expect(cues[0]!.startSec).toBe(0);
    expect(cues[cues.length - 1]!.endSec).toBeGreaterThan(0);
  });
});

describe('Iraqi TTS provider honesty', () => {
  it('never synthesizes a fake Iraqi voice', async () => {
    await expect(new IraqiTTSProvider().synthesize()).rejects.toMatchObject({ code: IRAQI_TTS_NOT_CONFIGURED });
  });
});

describe('unsupported worker jobs', () => {
  it('refuses lip-sync and 4K upscale without a provider', async () => {
    const prisma = {
      creativeGenerationJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'x',
          type: CreativeJobType.LIPSYNC,
          status: CreativeJobStatus.QUEUED,
        }),
      },
    };
    const svc = new CreativeGenerationService(
      prisma as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      {} as never,
      {} as never,
      { assertAvailable: jest.fn() } as never,
      { synthesize: jest.fn() } as never,
      { createLipSyncJob: jest.fn() } as never,
      { upscale: jest.fn() } as never,
    );
    await expect(svc.process('x')).rejects.toMatchObject({ code: LIPSYNC_NOT_CONFIGURED });
    prisma.creativeGenerationJob.findUnique.mockResolvedValue({
      id: 'y',
      type: CreativeJobType.UPSCALE,
      status: CreativeJobStatus.QUEUED,
    });
    await expect(svc.process('y')).rejects.toMatchObject({ code: FOUR_K_UPSCALE_NOT_CONFIGURED });
  });
});
