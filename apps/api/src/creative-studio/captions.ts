export type CaptionCue = {
  startSec: number;
  endSec: number;
  text: string;
};

export type CaptionStyle = {
  fontSize: number;
  position: 'bottom' | 'top' | 'center';
  background: boolean;
  rtl: boolean;
};

export function captionsFromScript(script: string, durationSec: number, language = 'ar'): CaptionCue[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (!words.length || durationSec <= 0) return [];
  const chunkSize = language.startsWith('ar') ? 4 : 6;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  const slice = durationSec / chunks.length;
  return chunks.map((text, index) => ({
    startSec: Number((index * slice).toFixed(2)),
    endSec: Number(((index + 1) * slice).toFixed(2)),
    text,
  }));
}

export function cuesToAss(cues: CaptionCue[], style: CaptionStyle, playResX: number, playResY: number) {
  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
  const back = style.background ? '&H80000000' : '&H00000000';
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Alignment, MarginV
Style: Default,Arial,${style.fontSize},&H00FFFFFF,${back},0,${alignment},40

[Events]
Format: Layer, Start, End, Style, Text
`;
  const events = cues
    .map((cue) => `Dialogue: 0,${assTime(cue.startSec)},${assTime(cue.endSec)},Default,${cue.text.replace(/\n/g, '\\N')}`)
    .join('\n');
  return header + events;
}

function assTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
