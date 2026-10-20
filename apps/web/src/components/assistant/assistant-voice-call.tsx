'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneOff, Settings2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getVoiceSnapshot,
  hangupVoice,
  hideVoiceCallUi,
  resetVoiceToPicker,
  setVoiceChoice,
  setVoiceLanguage,
  startVoiceCall,
  subscribeVoice,
  toggleVoiceMute,
  toggleVoiceSpeaker,
  unlockVoiceAudio,
} from '@/components/assistant/assistant-voice-runtime';

export function AssistantVoiceCall(props: {
  dir: 'rtl' | 'ltr';
  locale: 'ar' | 'en';
  conversationId?: string | null;
  labels: Record<string, string>;
}) {
  const [, setRev] = useState(0);
  useEffect(() => subscribeVoice(() => setRev((n) => n + 1)), []);
  useEffect(() => {
    setVoiceLanguage(props.locale);
  }, [props.locale]);

  const snap = getVoiceSnapshot();
  if (!snap.uiOpen) return null;
  const l = props.labels;
  const phase = snap.phase;
  const pulse = phase === 'listening' ? 0.35 + snap.level * 0.65 : phase === 'speaking' ? 0.7 : 0.2;

  return (
    <div
      className={cn(
        'fixed z-[80] flex flex-col bg-background shadow-2xl',
        phase === 'picker'
          ? 'inset-0 items-center justify-center bg-black/40 p-4'
          : 'bottom-5 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border p-3 ltr:right-5 rtl:left-5',
      )}
      dir={props.dir}
    >
      <div className={cn('flex w-full flex-col', phase === 'picker' && 'max-w-md rounded-2xl border bg-background p-5')}>
        <p className="text-center text-sm font-semibold">{l.callTitle}</p>
        {phase === 'picker' ? (
          <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-sm font-medium">{l.chooseVoice}</p>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVoiceChoice('cedar')}
                className={cn('rounded-2xl border p-4 text-sm transition', snap.voice === 'cedar' && 'border-primary bg-primary/10')}
              >
                <span className="block text-2xl">👨</span>
                <span className="mt-2 block font-semibold">{l.maleVoice}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Cedar</span>
              </button>
              <button
                type="button"
                onClick={() => setVoiceChoice('marin')}
                className={cn('rounded-2xl border p-4 text-sm transition', snap.voice === 'marin' && 'border-primary bg-primary/10')}
              >
                <span className="block text-2xl">👩</span>
                <span className="mt-2 block font-semibold">{l.femaleVoice}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Marin</span>
              </button>
            </div>
            {snap.error === 'mic' && <p className="text-center text-xs text-destructive">{l.micCallDenied}</p>}
            {snap.error && snap.error !== 'mic' && <p className="text-center text-xs text-destructive">{snap.error}</p>}
            <Button className="mt-2 w-full max-w-sm" onClick={() => void startVoiceCall(props.conversationId)}>
              {l.startVoiceChat}
            </Button>
            <Button variant="ghost" onClick={() => hideVoiceCallUi()}>
              {l.hangup}
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-col items-center">
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full',
                  phase === 'speaking' ? 'bg-emerald-500/20' : 'bg-primary/15',
                )}
                style={{ boxShadow: `0 0 ${18 + pulse * 28}px hsl(var(--primary) / ${0.25 + pulse * 0.45})` }}
              >
                {phase === 'connecting' || phase === 'thinking' ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : (
                  <Mic className={cn('h-7 w-7 text-primary', phase === 'listening' && 'animate-pulse')} />
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {phase === 'connecting' && l.connecting}
                {phase === 'connected' && l.connected}
                {phase === 'listening' && l.callListening}
                {phase === 'thinking' && l.thinking}
                {phase === 'speaking' && l.callSpeaking}
              </p>
              <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => void resetVoiceToPicker()}>
                <Settings2 className="mr-1 inline h-3 w-3" />
                {l.changeVoice}
              </button>
            </div>
            <div className="mt-3 max-h-24 flex-1 space-y-2 overflow-y-auto text-xs">
              {snap.lines.map((line, index) => (
                <p key={`${line.role}-${index}`} className={line.role === 'user' ? 'text-right' : 'text-left'}>
                  <span className="font-semibold">{line.role === 'user' ? l.you : 'Chatloora AI'}: </span>
                  {line.text}
                </p>
              ))}
            </div>
            {snap.needsGesture && (
              <Button className="mt-2" variant="secondary" onClick={unlockVoiceAudio}>
                <Volume2 className="mr-2 h-4 w-4" />
                {l.enableSound}
              </Button>
            )}
            {snap.handoffUrl && (
              <a
                href={snap.handoffUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white"
              >
                {l.talkHuman}
              </a>
            )}
            <div className="mt-auto flex items-center justify-center gap-3 pt-4">
              <Button type="button" variant={snap.muted ? 'destructive' : 'outline'} size="icon" onClick={toggleVoiceMute} title={l.mute}>
                {snap.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant={snap.speakerOn ? 'outline' : 'secondary'}
                size="icon"
                onClick={toggleVoiceSpeaker}
                title={l.speaker}
              >
                {snap.speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="destructive" onClick={() => void hangupVoice('hangup')}>
                <PhoneOff className="mr-2 h-4 w-4" />
                {l.hangup}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
