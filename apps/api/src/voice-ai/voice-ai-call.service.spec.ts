import { VoiceAiCallService } from './voice-ai-call.service';

describe('VoiceAiCallService incoming', () => {
  function service(overrides?: Partial<{ enabled: boolean; number: unknown }>) {
    const settings = {
      getPlatform: jest.fn().mockResolvedValue({ enabled: overrides?.enabled ?? true }),
    };
    const prisma = {
      voicePhoneNumber: {
        findFirst: jest.fn().mockResolvedValue(overrides?.number ?? null),
      },
      voiceCall: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'call-1' }),
      },
    };
    const calls = new VoiceAiCallService(
      prisma as never,
      settings as never,
      {} as never,
      { assertVoiceAiEnabled: jest.fn() } as never,
      { get: jest.fn().mockReturnValue('https://example.com') } as never,
    );
    return { calls, prisma };
  }

  it('rejects incoming calls when Voice AI is disabled', async () => {
    const { calls } = service({ enabled: false });
    const xml = await calls.startIncoming({ callSid: 'CA1', from: '+9647700000000', to: '+9647800000000' });
    expect(xml).toContain('متوقفة');
    expect(xml).toContain('<Hangup/>');
  });

  it('rejects unknown numbers', async () => {
    const { calls } = service({ enabled: true, number: null });
    const xml = await calls.startIncoming({ callSid: 'CA1', from: '+9647700000000', to: '+9647800000000' });
    expect(xml).toContain('متوقفة');
    expect(xml).toContain('<Hangup/>');
  });

  it('creates a voice session for a mapped platform number', async () => {
    const { calls, prisma } = service({
      enabled: true,
      number: {
        id: 'num-1',
        teamId: null,
        agentId: 'ag-1',
        agent: {
          enabled: true,
          greeting: 'أهلاً',
          language: 'ar-AE',
          voiceName: 'Polly.Zeina',
          minutesLimit: -1,
          minutesUsed: 0,
        },
      },
    });
    const xml = await calls.startIncoming({ callSid: 'CA99', from: '+9647700000000', to: '+9647800000000' });
    expect(prisma.voiceCall.create).not.toHaveBeenCalled();
    expect(xml).toContain('متوقفة');
    expect(xml).toContain('<Hangup/>');
  });
});
