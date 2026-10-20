import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AssistantRealtimeService } from './assistant-realtime.service';
import { quotaMessages, resolveRealtimeVoice } from './assistant-realtime.util';

function prismaMock() {
  return {
    systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: {} }) },
    platformAssistantConversation: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    },
    platformAssistantMessage: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    assistantVoiceSession: {
      create: jest.fn().mockResolvedValue({
        id: 'sess-1',
        model: 'gpt-realtime-2.1',
        voice: 'marin',
        conversationId: 'conv-1',
      }),
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { durationSec: 0 } }),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('AssistantRealtimeService', () => {
  const settings = { get: jest.fn().mockResolvedValue({ enabled: true, systemPrompt: 'core', supportWhatsApp: '9647864314333', supportPhone: '' }) };
  const knowledge = { retrieve: jest.fn().mockResolvedValue([]) };
  const context = { snapshot: jest.fn().mockResolvedValue({ plan: 'pro', channels: [] }) };
  const entitlements = {
    assertVoiceAiEnabled: jest.fn().mockResolvedValue({ limits: { voiceMinutesLimit: -1, voiceCallsLimit: -1 } }),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test';
      if (key === 'VOICE_AI_MODEL') return 'gpt-realtime-2.1';
      if (key === 'VOICE_AI_ENABLED') return 'true';
      return undefined;
    }),
  };

  beforeEach(() => {
    entitlements.assertVoiceAiEnabled.mockResolvedValue({ limits: { voiceMinutesLimit: -1, voiceCallsLimit: -1 } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ value: 'eph_test_secret_value_ok' }),
    });
  });

  function service(db = prismaMock()) {
    return {
      db,
      instance: new AssistantRealtimeService(
        db as never,
        settings as never,
        knowledge as never,
        context as never,
        entitlements as never,
        config as never,
      ),
    };
  }

  it('creates a tenant-scoped session with the selected official voice', async () => {
    const { instance } = service();
    await expect(instance.createSession('team-a', 'user-a', { voice: 'cedar' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('refuses sessions for another tenant', async () => {
    const { instance, db } = service();
    db.assistantVoiceSession.findFirst.mockResolvedValue(null);
    await expect(instance.connectSdp('team-b', 'user-b', 'sess-1', 'v=0')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks starting a call when monthly minutes are exhausted', async () => {
    entitlements.assertVoiceAiEnabled.mockResolvedValueOnce({ limits: { voiceMinutesLimit: 10, voiceCallsLimit: -1 } });
    const { instance, db } = service();
    db.assistantVoiceSession.aggregate.mockResolvedValueOnce({ _sum: { durationSec: 10 * 60 } });
    await expect(instance.createSession('team-a', 'user-a', { voice: 'marin' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(quotaMessages('minutes')).toContain('انتهت دقائق');
  });

  it('rejects unauthorized tools', async () => {
    const { instance, db } = service();
    db.assistantVoiceSession.findFirst.mockResolvedValue({ id: 'sess-1', teamId: 'team-a', userId: 'user-a' });
    await expect(instance.runTool('team-a', 'user-a', 'sess-1', { name: 'cancel_subscription' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runs knowledge and snapshot tools for the owning tenant only', async () => {
    const { instance, db } = service();
    db.assistantVoiceSession.findFirst.mockResolvedValue({ id: 'sess-1', teamId: 'team-a', userId: 'user-a' });
    const snap = await instance.runTool('team-a', 'user-a', 'sess-1', { name: 'get_workspace_status' });
    expect(context.snapshot).toHaveBeenCalledWith('team-a');
    expect(snap.output).toEqual({ plan: 'pro', channels: [] });
    await instance.runTool('team-a', 'user-a', 'sess-1', {
      name: 'search_knowledge',
      arguments: '{"query":"شلون أربط الواتساب"}',
    });
    expect(knowledge.retrieve).toHaveBeenCalledWith('شلون أربط الواتساب');
  });

  it('maps English and Iraqi handoff to the WhatsApp client event', async () => {
    const { instance, db } = service();
    db.assistantVoiceSession.findFirst.mockResolvedValue({ id: 'sess-1', teamId: 'team-a', userId: 'user-a' });
    const result = await instance.runTool('team-a', 'user-a', 'sess-1', { name: 'request_human_support' });
    expect(result.clientEvent).toEqual(expect.objectContaining({ type: 'handoff' }));
    expect(String((result.clientEvent as { supportUrl: string }).supportUrl)).toContain('wa.me/9647864314333');
  });

  it('exchanges SDP with OpenAI using the server key, never returning it', async () => {
    const { instance, db } = service();
    db.assistantVoiceSession.findFirst.mockResolvedValue({
      id: 'sess-1',
      teamId: 'team-a',
      userId: 'user-a',
      status: 'created',
      voice: 'marin',
      model: 'gpt-realtime-2.1',
      conversationId: 'conv-1',
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => 'v=0\r\no=openai' });
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await instance.connectSdp('team-a', 'user-a', 'sess-1', 'v=0\r\no=client');
    expect(result.sdp).toContain('o=openai');
    const auth = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization;
    expect(auth).toBe('Bearer sk-test');
    expect(JSON.stringify(result)).not.toContain('sk-test');
  });

  it('uses the official realtime model alias', () => {
    const { instance } = service();
    expect(instance.realtimeModel()).toBe('gpt-realtime-2.1');
    expect(resolveRealtimeVoice('male')).toBe('cedar');
  });

  it('fails closed when OpenAI refuses to mint a realtime secret', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
    });
    const { instance } = service();
    await expect(instance.createSession('team-a', 'user-a', { voice: 'marin' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
