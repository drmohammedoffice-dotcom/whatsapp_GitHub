export const REALTIME_MALE_VOICE = 'cedar';
export const REALTIME_FEMALE_VOICE = 'marin';
export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1';
export const REALTIME_MODEL_FALLBACKS = ['gpt-realtime-2.1', 'gpt-realtime-2', 'gpt-realtime'] as const;
export const VOICE_PICKER_STORAGE_KEY = 'chatloora.assistant.voice';

export type RealtimeVoiceId = typeof REALTIME_MALE_VOICE | typeof REALTIME_FEMALE_VOICE;

export const REALTIME_VOICES: Array<{
  id: RealtimeVoiceId;
  gender: 'male' | 'female';
  labelAr: string;
  labelEn: string;
}> = [
  { id: REALTIME_MALE_VOICE, gender: 'male', labelAr: 'Cedar — صوت رجالي', labelEn: 'Cedar — masculine voice' },
  { id: REALTIME_FEMALE_VOICE, gender: 'female', labelAr: 'Marin — صوت نسائي', labelEn: 'Marin — feminine voice' },
];

export function resolveRealtimeVoice(raw?: string | null): RealtimeVoiceId {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === REALTIME_MALE_VOICE || value === 'male' || value === 'man' || value === 'ash' || value === 'echo' || value === 'verse') {
    return REALTIME_MALE_VOICE;
  }
  return REALTIME_FEMALE_VOICE;
}

export function voiceGender(voice: string): 'male' | 'female' {
  return resolveRealtimeVoice(voice) === REALTIME_MALE_VOICE ? 'male' : 'female';
}

export function monthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export function minutesFromSeconds(seconds: number) {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / 60);
}

export const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'get_workspace_status',
    description:
      'Read the signed-in Chatloora workspace snapshot: plan, subscription, enabled features, connected channels. Never returns secrets.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'search_knowledge',
    description: 'Search Chatloora product knowledge base (WhatsApp, Instagram, TikTok, billing, AI, appointments).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'User question or keywords' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'request_human_support',
    description: 'User asked to talk to a human support agent. Call this instead of reading a URL aloud.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'navigate_in_app',
    description:
      'Open an allowed in-app Chatloora page for the user. Only use paths from the navigation catalog. Opening a page does NOT end the voice call — stay on the call and keep talking.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
] as const;

export const ALLOWED_REALTIME_TOOLS: Set<string> = new Set(REALTIME_TOOLS.map((tool) => tool.name));

export function buildRealtimeVoicePrompt(input: {
  systemPrompt: string;
  knowledge: string;
  snapshotJson: string;
  navigationCatalog: string;
  history: Array<{ role: string; content: string }>;
  supportHint: string;
}) {
  const historyBlock = input.history
    .slice(-12)
    .map((row) => `${row.role === 'USER' ? 'المستخدم' : 'المساعد'}: ${row.content.slice(0, 400)}`)
    .join('\n');

  return `${input.systemPrompt}

أنت الآن في مكالمة صوتية مباشرة (Voice-to-Voice) مع المستخدم داخل Chatloora. الصوت هو الأساس.

أسلوب الصوت:
- تحدّث بجمل قصيرة طبيعية كمكالمة هاتفية، لا كصفحة مساعدة.
- أجب بنفس لغة المستخدم: فصحى / لهجة عراقية خفيفة / إنجليزية. إذا تحدّث عراقياً استخدم عبارات عراقية مهنية دون مبالغة.
- لا تقرأ Markdown ولا الرموز ولا الروابط حرفياً. لا تقل https أو دبليو دبليو دبليو.
- إذا احتيج واتساب الدعم قل فقط أنه يمكنه الضغط على زر التواصل مع موظف، ولا تتهجّى الرابط.
- لا تقرأ القوائم الطويلة. اسأل سؤالاً واحداً واضحاً ثم انتظر.
- إذا قاطعك المستخدم توقف فوراً واستمع للسؤال الجديد.
- إذا فتحت صفحة داخل المنصة عبر الأداة، لا تنهِ المكالمة ولا تودّع. ابقَ متصلاً وأكمل الشرح صوتياً بينما المستخدم يرى الصفحة.
- لا تدّعِ تنفيذ عمليات خطرة (إلغاء اشتراك، حذف بيانات، تغيير توكنات). اطلب تأكيداً لفظياً واشرح أن التنفيذ يتم من لوحة المستخدم.
- ${input.supportHint}

معرفة المنصة ذات الصلة:
${input.knowledge || 'لا توجد مقالة مطابقة؛ استخدم حالة الحساب واسأل توضيحاً إن لزم.'}

حالة الحساب الآمنة (بدون أسرار):
${input.snapshotJson}

صفحات يمكن فتحها بأداة navigate_in_app فقط:
${input.navigationCatalog}

سياق المحادثة النصية السابقة (إن وجد):
${historyBlock || 'لا يوجد سياق نصي سابق.'}`;
}

export type RealtimeTranscriptTurn = { role: 'user' | 'assistant'; content: string; at: string };

export function appendTranscriptTurn(existing: unknown, turn: RealtimeTranscriptTurn, max = 80): RealtimeTranscriptTurn[] {
  const list = Array.isArray(existing) ? (existing as RealtimeTranscriptTurn[]) : [];
  const next = [...list, turn];
  return next.slice(-max);
}

export function parseRealtimeUsage(raw: unknown): { audioInputMs?: number; audioOutputMs?: number; textTokens?: number } {
  if (!raw || typeof raw !== 'object') return {};
  const row = raw as Record<string, unknown>;
  const input = typeof row.input_audio_ms === 'number' ? row.input_audio_ms : typeof row.inputAudioMs === 'number' ? row.inputAudioMs : undefined;
  const output = typeof row.output_audio_ms === 'number' ? row.output_audio_ms : typeof row.outputAudioMs === 'number' ? row.outputAudioMs : undefined;
  const tokens = typeof row.total_tokens === 'number' ? row.total_tokens : undefined;
  return { audioInputMs: input, audioOutputMs: output, textTokens: tokens };
}

export function estimateCostMillis(usage: { audioInputMs?: number; audioOutputMs?: number }) {
  const inMin = (usage.audioInputMs ?? 0) / 60000;
  const outMin = (usage.audioOutputMs ?? 0) / 60000;
  // Rough list-price placeholder for gpt-realtime audio ($/min); stored for admin pricing later, not billed to the tenant here.
  return Math.round(inMin * 32 * 1000 + outMin * 64 * 1000);
}

export function quotaMessages(kind: 'disabled' | 'minutes' | 'calls', locale: 'ar' | 'en' = 'ar') {
  if (locale === 'en') {
    if (kind === 'minutes') return 'You have used all Voice AI minutes included in your plan.';
    if (kind === 'calls') return 'You have reached the Voice AI call limit on your plan.';
    return 'Voice AI is not included in your current plan.';
  }
  if (kind === 'minutes') return 'انتهت دقائق المساعد الصوتي المتاحة في باقتك.';
  if (kind === 'calls') return 'وصلت إلى الحد الأقصى لمكالمات المساعد الصوتي في باقتك.';
  return 'المساعد الصوتي غير متاح في باقتك الحالية.';
}

export function extractFunctionCall(event: Record<string, unknown>): { callId: string; name: string; arguments: string } | null {
  if (event.type === 'response.function_call_arguments.done') {
    const name = typeof event.name === 'string' ? event.name : '';
    const callId = typeof event.call_id === 'string' ? event.call_id : '';
    const args = typeof event.arguments === 'string' ? event.arguments : '{}';
    if (name && callId) return { callId, name, arguments: args };
  }
  const response = event.response as { output?: Array<Record<string, unknown>> } | undefined;
  if (event.type === 'response.done' && Array.isArray(response?.output)) {
    const fn = response.output.find((item) => item.type === 'function_call');
    if (fn && typeof fn.name === 'string' && typeof fn.call_id === 'string') {
      return {
        callId: fn.call_id,
        name: fn.name,
        arguments: typeof fn.arguments === 'string' ? fn.arguments : '{}',
      };
    }
  }
  return null;
}

export function extractClientSecret(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.value === 'string' && row.value.trim().length > 16) return row.value.trim();
  const nested = row.client_secret;
  if (nested && typeof nested === 'object') {
    const value = (nested as { value?: unknown }).value;
    if (typeof value === 'string' && value.trim().length > 16) return value.trim();
  }
  const data = row.data;
  if (data && typeof data === 'object') {
    const value = (data as { value?: unknown }).value;
    if (typeof value === 'string' && value.trim().length > 16) return value.trim();
  }
  return null;
}

export function openaiErrorSnippet(body: string) {
  return body.replace(/sk-[a-zA-Z0-9_\-]+/g, '[redacted]').replace(/eyJ[a-zA-Z0-9._\-]+/g, '[redacted]').slice(0, 400);
}
