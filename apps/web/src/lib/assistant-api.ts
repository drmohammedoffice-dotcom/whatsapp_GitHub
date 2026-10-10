import { api, apiUpload, authedFetch, API_URL } from './utils';

export type AssistantSuggestion = { id?: string; ar: string; en: string };

export type AssistantAction = {
  type: 'navigate';
  path: string;
  labelAr: string;
  labelEn: string;
};

export type AssistantConfig = {
  enabled: boolean;
  welcomeAr: string;
  welcomeEn: string;
  supportPhone: string;
  supportUrl: string;
  suggestions: AssistantSuggestion[];
  voice?: {
    realtimeEnabled: boolean;
    model: string;
    voices: Array<{ id: string; gender: 'male' | 'female'; labelAr: string; labelEn: string }>;
    defaultVoice: string;
    maxCallDurationSec: number;
    transcriptEnabled: boolean;
  };
};

export type AssistantVoiceSession = {
  sessionId: string;
  conversationId: string;
  voice: string;
  model: string;
  clientSecret: string;
  callsUrl: string;
  maxCallDurationSec: number;
  transcriptEnabled: boolean;
  supportUrl: string;
};

export function createAssistantVoiceSession(input: { conversationId?: string; voice: string; language?: string }) {
  return api<AssistantVoiceSession>('/assistant/voice/session', { method: 'POST', body: JSON.stringify(input) });
}

export function connectAssistantVoiceSdp(sessionId: string, sdp: string) {
  return api<{ sdp: string }>(`/assistant/voice/session/${sessionId}/sdp`, { method: 'POST', body: JSON.stringify({ sdp }) });
}

export function runAssistantVoiceTool(sessionId: string, input: { name: string; arguments?: string; callId?: string }) {
  return api<{
    callId?: string;
    output: unknown;
    clientEvent?: { type: string; path?: string; supportUrl?: string; labelAr?: string; labelEn?: string };
  }>(`/assistant/voice/session/${sessionId}/tools`, { method: 'POST', body: JSON.stringify(input) });
}

export function ingestAssistantVoiceEvent(sessionId: string, body: { event?: Record<string, unknown>; usage?: unknown }) {
  return api<{ ok: boolean }>(`/assistant/voice/session/${sessionId}/events`, { method: 'POST', body: JSON.stringify(body) });
}

export function endAssistantVoiceSession(sessionId: string, reason?: string) {
  return api<{ ok: boolean; durationSec: number }>(`/assistant/voice/session/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? 'hangup' }),
  });
}

export type AssistantMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  helpful?: boolean | null;
  unanswered?: boolean;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  actions?: AssistantAction[] | null;
  createdAt: string;
};

export type AssistantConversation = {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: AssistantMessage[];
};

export type AssistantChatResult = {
  conversationId: string;
  message: AssistantMessage;
  supportUrl: string;
  showSupport: boolean;
  suggestions: AssistantSuggestion[];
  actions?: AssistantAction[];
  autoNavigate?: boolean;
};

export function fetchAssistantConfig() {
  return api<AssistantConfig>('/assistant/config', {}, { redirectOnInvalid: false });
}

export function fetchAssistantConversations() {
  return api<AssistantConversation[]>('/assistant/conversations');
}

export function fetchAssistantConversation(id: string) {
  return api<AssistantConversation>(`/assistant/conversations/${id}`);
}

export function deleteAssistantConversation(id: string) {
  return api<{ deleted: boolean }>(`/assistant/conversations/${id}`, { method: 'DELETE' });
}

export function sendAssistantChat(input: { conversationId?: string; content: string }) {
  return api<AssistantChatResult>('/assistant/chat', { method: 'POST', body: JSON.stringify(input) });
}

export function sendAssistantMedia(input: { conversationId?: string; content?: string; file: File }) {
  const form = new FormData();
  form.append('file', input.file);
  if (input.conversationId) form.append('conversationId', input.conversationId);
  if (input.content) form.append('content', input.content);
  return apiUpload<AssistantChatResult>('/assistant/chat/media', form);
}

export async function speakAssistantText(text: string): Promise<Blob | null> {
  const response = await authedFetch(`${API_URL}/api/v1/assistant/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) return null;
  return response.blob();
}

export function sendAssistantFeedback(messageId: string, helpful: boolean) {
  return api<AssistantMessage>(`/assistant/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ helpful }),
  });
}
