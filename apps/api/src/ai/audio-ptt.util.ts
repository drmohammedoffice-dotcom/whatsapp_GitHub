import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * WhatsApp PTT voice notes work best as Ogg Opus.
 * Browser MediaRecorder often produces webm/opus — convert when ffmpeg is available.
 */
export async function ensureWhatsAppPttAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('ogg') || mime.includes('opus')) {
    return { buffer, mimeType: 'audio/ogg; codecs=opus' };
  }

  const workDir = join(tmpdir(), `wa-ptt-${randomUUID()}`);
  const inputExt = mime.includes('webm')
    ? 'webm'
    : mime.includes('mp4') || mime.includes('m4a')
      ? 'm4a'
      : mime.includes('mpeg') || mime.includes('mp3')
        ? 'mp3'
        : 'bin';
  const inputPath = join(workDir, `in.${inputExt}`);
  const outputPath = join(workDir, 'out.ogg');

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(inputPath, buffer);
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-vn',
      outputPath,
    ]);
    const converted = await readFile(outputPath);
    if (converted.length > 0) {
      return { buffer: converted, mimeType: 'audio/ogg; codecs=opus' };
    }
  } catch {
    // Fall through — send original bytes if ffmpeg is missing/fails.
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { buffer, mimeType: mimeType || 'audio/ogg; codecs=opus' };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-400) || `ffmpeg exited ${code}`));
    });
  });
}
