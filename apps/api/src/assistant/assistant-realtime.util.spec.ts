import {
  ALLOWED_REALTIME_TOOLS,
  appendTranscriptTurn,
  buildRealtimeVoicePrompt,
  estimateCostMillis,
  extractClientSecret,
  extractFunctionCall,
  minutesFromSeconds,
  parseRealtimeUsage,
  quotaMessages,
  resolveRealtimeVoice,
  voiceGender,
} from './assistant-realtime.util';
import { routeByPath } from './assistant-nav';
import { wantsHumanSupport } from './assistant.util';

describe('assistant realtime voice helpers', () => {
  it('maps male and female picker values to official OpenAI voices', () => {
    expect(resolveRealtimeVoice('male')).toBe('cedar');
    expect(resolveRealtimeVoice('cedar')).toBe('cedar');
    expect(resolveRealtimeVoice('female')).toBe('marin');
    expect(resolveRealtimeVoice('marin')).toBe('marin');
    expect(voiceGender('cedar')).toBe('male');
    expect(voiceGender('marin')).toBe('female');
  });

  it('builds a spoken Iraqi-aware prompt without URL spelling instructions', () => {
    const prompt = buildRealtimeVoicePrompt({
      systemPrompt: 'أنت مساعد Chatloora',
      knowledge: 'ربط واتساب من صفحة /whatsapp',
      snapshotJson: '{"plan":"pro"}',
      navigationCatalog: '/whatsapp',
      history: [{ role: 'USER', content: 'أريد أربط Instagram.' }],
      supportHint: 'استخدم أداة الدعم',
    });
    expect(prompt).toContain('لهجة عراقية');
    expect(prompt).toContain('أريد أربط Instagram');
    expect(prompt).toContain('لا تقل https');
    expect(prompt).toContain('لا تنهِ المكالمة');
    expect(prompt).toContain('{"plan":"pro"}');
  });

  it('only allows the safe realtime tool names', () => {
    expect(ALLOWED_REALTIME_TOOLS.has('get_workspace_status')).toBe(true);
    expect(ALLOWED_REALTIME_TOOLS.has('search_knowledge')).toBe(true);
    expect(ALLOWED_REALTIME_TOOLS.has('request_human_support')).toBe(true);
    expect(ALLOWED_REALTIME_TOOLS.has('navigate_in_app')).toBe(true);
    expect(ALLOWED_REALTIME_TOOLS.has('cancel_subscription')).toBe(false);
    expect(routeByPath('/admin')).toBeNull();
    expect(routeByPath('/plans')?.path).toBe('/plans');
  });

  it('detects human handoff phrases used in voice', () => {
    expect(wantsHumanSupport('أريد موظف')).toBe(true);
    expect(wantsHumanSupport('أريد أحچي ويا شخص')).toBe(true);
    expect(wantsHumanSupport('talk to a human')).toBe(true);
  });

  it('parses realtime function-call events', () => {
    const event = {
      type: 'response.function_call_arguments.done',
      name: 'search_knowledge',
      call_id: 'c1',
      arguments: '{"query":"واتساب"}',
    };
    expect(extractFunctionCall(event)).toEqual({
      callId: 'c1',
      name: 'search_knowledge',
      arguments: '{"query":"واتساب"}',
    });
  });

  it('extracts ephemeral client secrets from GA payloads', () => {
    expect(extractClientSecret({ value: 'eph_live_secret_value_1234' })).toBe('eph_live_secret_value_1234');
    expect(extractClientSecret({ client_secret: { value: 'eph_nested_secret_value' } })).toBe('eph_nested_secret_value');
    expect(extractClientSecret({ data: { value: 'eph_data_secret_value_ok' } })).toBe('eph_data_secret_value_ok');
    expect(extractClientSecret({})).toBeNull();
  });

  it('tracks transcript, usage, and quota copy', () => {
    const turns = appendTranscriptTurn([], { role: 'user', content: 'شلون أغير الباقة؟', at: 't1' });
    expect(turns[0].content).toContain('الباقة');
    expect(minutesFromSeconds(61)).toBe(2);
    expect(parseRealtimeUsage({ input_audio_ms: 1000, output_audio_ms: 2000 }).audioOutputMs).toBe(2000);
    expect(estimateCostMillis({ audioInputMs: 60000, audioOutputMs: 60000 })).toBeGreaterThan(0);
    expect(quotaMessages('minutes')).toContain('انتهت دقائق');
    expect(quotaMessages('minutes', 'en')).toContain('minutes');
  });
});
