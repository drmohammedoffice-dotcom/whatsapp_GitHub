import {
  connectAssistantVoiceSdp,
  createAssistantVoiceSession,
  endAssistantVoiceSession,
  ingestAssistantVoiceEvent,
  runAssistantVoiceTool,
} from '@/lib/assistant-api';

export type VoicePhase = 'picker' | 'connecting' | 'connected' | 'listening' | 'thinking' | 'speaking';
export type VoiceLine = { role: 'user' | 'assistant'; text: string };

export type VoiceSnapshot = {
  uiOpen: boolean;
  phase: VoicePhase;
  voice: 'cedar' | 'marin';
  muted: boolean;
  speakerOn: boolean;
  needsGesture: boolean;
  error: string | null;
  handoffUrl: string | null;
  lines: VoiceLine[];
  level: number;
  conversationId: string | null;
};

const VOICE_KEY = 'chatloora.assistant.voice';

type VoiceHandlers = {
  onNavigate?: (path: string) => void;
  onHandoff?: (url: string) => void;
  onConversation?: (id: string) => void;
  onTranscript?: (role: 'USER' | 'ASSISTANT', text: string) => void;
};

const listeners = new Set<() => void>();
let handlers: VoiceHandlers = {};
let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let audioEl: HTMLAudioElement | null = null;
let dc: RTCDataChannel | null = null;
let sessionId: string | null = null;
let limitTimer: number | null = null;
let meterTimer: number | null = null;
let meterCtx: AudioContext | null = null;
let remoteSpeaking = false;
let assistantBuf = '';
let language: 'ar' | 'en' = 'ar';

let snapshot: VoiceSnapshot = emptySnapshot();

function emptySnapshot(): VoiceSnapshot {
  return {
    uiOpen: false,
    phase: 'picker',
    voice: loadVoice(),
    muted: false,
    speakerOn: true,
    needsGesture: false,
    error: null,
    handoffUrl: null,
    lines: [],
    level: 0,
    conversationId: null,
  };
}

function loadVoice(): 'cedar' | 'marin' {
  if (typeof window === 'undefined') return 'marin';
  return window.localStorage.getItem(VOICE_KEY) === 'cedar' ? 'cedar' : 'marin';
}

function emit() {
  listeners.forEach((fn) => fn());
}

function patch(partial: Partial<VoiceSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  emit();
}

export function getVoiceSnapshot() {
  return snapshot;
}

export function subscribeVoice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setVoiceHandlers(next: VoiceHandlers) {
  handlers = { ...handlers, ...next };
}

export function showVoiceCall() {
  if (snapshot.uiOpen && snapshot.phase !== 'picker' && pc) {
    patch({ uiOpen: true });
    return;
  }
  patch({
    uiOpen: true,
    phase: snapshot.phase !== 'picker' && pc ? snapshot.phase : 'picker',
    error: null,
    voice: loadVoice(),
  });
}

export function hideVoiceCallUi() {
  if (pc && snapshot.phase !== 'picker') return;
  patch({ uiOpen: false, phase: 'picker' });
}

export function setVoiceChoice(voice: 'cedar' | 'marin') {
  patch({ voice });
}

export function toggleVoiceMute() {
  const muted = !snapshot.muted;
  stream?.getAudioTracks().forEach((track) => {
    track.enabled = !muted;
  });
  patch({ muted });
}

export function toggleVoiceSpeaker() {
  const speakerOn = !snapshot.speakerOn;
  if (audioEl) audioEl.muted = !speakerOn;
  patch({ speakerOn });
}

export function unlockVoiceAudio() {
  void audioEl
    ?.play()
    .then(() => patch({ needsGesture: false }))
    .catch(() => undefined);
}

function stopMeter() {
  if (meterTimer) window.clearInterval(meterTimer);
  meterTimer = null;
  void meterCtx?.close().catch(() => undefined);
  meterCtx = null;
}

function startMeter(media: MediaStream) {
  stopMeter();
  meterCtx = new AudioContext();
  const source = meterCtx.createMediaStreamSource(media);
  const analyser = meterCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  meterTimer = window.setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const v = (value - 128) / 128;
      sum += v * v;
    }
    patch({ level: Math.min(1, Math.sqrt(sum / data.length) * 8) });
  }, 80);
}

async function teardown(reason: string) {
  stopMeter();
  if (limitTimer) window.clearTimeout(limitTimer);
  limitTimer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  pc?.close();
  pc = null;
  audioEl?.pause();
  audioEl = null;
  dc = null;
  remoteSpeaking = false;
  assistantBuf = '';
  const id = sessionId;
  sessionId = null;
  if (id) await endAssistantVoiceSession(id, reason).catch(() => undefined);
}

export async function hangupVoice(reason = 'hangup') {
  await teardown(reason);
  snapshot = { ...emptySnapshot(), voice: loadVoice() };
  emit();
}

export async function resetVoiceToPicker() {
  await teardown('hangup');
  patch({
    uiOpen: true,
    phase: 'picker',
    error: null,
    lines: [],
    handoffUrl: null,
    needsGesture: false,
    muted: false,
    speakerOn: true,
    level: 0,
    voice: loadVoice(),
  });
}

async function onRealtimeEvent(raw: string) {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const type = String(event.type ?? '');
  if (type === 'input_audio_buffer.speech_started') {
    patch({ phase: 'listening' });
    if (remoteSpeaking) {
      remoteSpeaking = false;
      dc?.send(JSON.stringify({ type: 'response.cancel' }));
    }
  }
  if (type === 'input_audio_buffer.speech_stopped') patch({ phase: 'thinking' });
  if (type === 'response.created' || type === 'response.output_audio.delta' || type === 'response.audio.delta') {
    remoteSpeaking = true;
    patch({ phase: 'speaking' });
  }
  if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
    assistantBuf += String(event.delta ?? '');
    patch({ phase: 'speaking' });
  }
  if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done' || type === 'response.done') {
    const text = (typeof event.transcript === 'string' ? event.transcript : assistantBuf).trim();
    assistantBuf = '';
    if (text) {
      patch({ lines: [...snapshot.lines.slice(-12), { role: 'assistant', text }] });
      handlers.onTranscript?.('ASSISTANT', text);
    }
    if (sessionId) void ingestAssistantVoiceEvent(sessionId, { event, usage: (event.response as { usage?: unknown } | undefined)?.usage });
    patch({ phase: 'listening' });
  }
  if (type === 'conversation.item.input_audio_transcription.completed') {
    const text = String(event.transcript ?? '').trim();
    if (text) {
      patch({ lines: [...snapshot.lines.slice(-12), { role: 'user', text }] });
      handlers.onTranscript?.('USER', text);
      if (sessionId) void ingestAssistantVoiceEvent(sessionId, { event });
    }
  }
  if (type === 'response.function_call_arguments.done' && sessionId) {
    const name = String(event.name ?? '');
    const callId = String(event.call_id ?? '');
    const args = typeof event.arguments === 'string' ? event.arguments : '{}';
    const result = await runAssistantVoiceTool(sessionId, { name, arguments: args, callId });
    if (result.clientEvent?.type === 'handoff' && result.clientEvent.supportUrl) {
      patch({ handoffUrl: result.clientEvent.supportUrl });
      handlers.onHandoff?.(result.clientEvent.supportUrl);
    }
    const path = result.clientEvent?.type === 'navigate' ? result.clientEvent.path : undefined;
    dc?.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result.output ?? {}) },
      }),
    );
    dc?.send(JSON.stringify({ type: 'response.create' }));
    if (path) {
      window.setTimeout(() => {
        handlers.onNavigate?.(path);
        window.dispatchEvent(new CustomEvent('chatloora-voice-navigate', { detail: { path } }));
      }, 400);
    }
  }
}

export async function startVoiceCall(conversationId?: string | null) {
  if (pc && snapshot.phase !== 'picker') return;
  patch({ error: null, phase: 'connecting', uiOpen: true });
  window.localStorage.setItem(VOICE_KEY, snapshot.voice);
  let media: MediaStream;
  try {
    media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    patch({ error: 'mic', phase: 'picker' });
    return;
  }
  stream = media;
  try {
    const session = await createAssistantVoiceSession({
      conversationId: conversationId ?? snapshot.conversationId ?? undefined,
      voice: snapshot.voice,
      language,
    });
    sessionId = session.sessionId;
    patch({ conversationId: session.conversationId, handoffUrl: session.supportUrl || snapshot.handoffUrl });
    handlers.onConversation?.(session.conversationId);

    const peer = new RTCPeerConnection();
    pc = peer;
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    audioEl = audio;
    peer.ontrack = (event) => {
      audio.srcObject = event.streams[0];
      void audio.play().catch(() => patch({ needsGesture: true }));
    };
    media.getTracks().forEach((track) => peer.addTrack(track, media));
    const channel = peer.createDataChannel('oai-events');
    dc = channel;
    channel.addEventListener('message', (event) => void onRealtimeEvent(event.data));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const callsUrl = session.callsUrl || 'https://api.openai.com/v1/realtime/calls';
    let answerSdp = '';
    if (session.clientSecret) {
      const sdpResponse = await fetch(callsUrl, {
        method: 'POST',
        body: offer.sdp ?? '',
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });
      answerSdp = await sdpResponse.text();
      if (!sdpResponse.ok || !answerSdp.includes('v=0')) {
        const fallback = await connectAssistantVoiceSdp(session.sessionId, offer.sdp ?? '');
        answerSdp = fallback.sdp;
      }
    } else {
      const fallback = await connectAssistantVoiceSdp(session.sessionId, offer.sdp ?? '');
      answerSdp = fallback.sdp;
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    startMeter(media);
    patch({ phase: 'connected' });
    window.setTimeout(() => {
      if (snapshot.uiOpen && snapshot.phase !== 'speaking') patch({ phase: 'listening' });
    }, 400);
    limitTimer = window.setTimeout(() => {
      void hangupVoice('limit');
    }, (session.maxCallDurationSec || 600) * 1000);
  } catch (err) {
    media.getTracks().forEach((track) => track.stop());
    stream = null;
    patch({ error: err instanceof Error ? err.message : 'connect', phase: 'picker' });
  }
}

export function setVoiceLanguage(next: 'ar' | 'en') {
  language = next;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pc) void hangupVoice('hangup');
  });
}
