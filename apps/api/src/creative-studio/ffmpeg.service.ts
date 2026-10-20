import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { FFMPEG_NOT_AVAILABLE, GENERATION_FAILED, ProviderError } from './providers/provider-error';

export type MixLevels = { voice: number; music: number };

@Injectable()
export class FfmpegComposeService {
  private readonly logger = new Logger(FfmpegComposeService.name);

  async isAvailable(): Promise<boolean> {
    try {
      await this.run(['-version'], 15_000);
      return true;
    } catch {
      return false;
    }
  }

  async assertAvailable() {
    if (!(await this.isAvailable())) {
      throw new ProviderError(FFMPEG_NOT_AVAILABLE, 'FFmpeg غير متوفر على العامل (worker).', 503);
    }
  }

  async composeFinal(input: {
    clips: Array<{ videoPath?: string; imagePath?: string; audioPath?: string; durationSec: number }>;
    musicPath?: string;
    captionAssPath?: string;
    aspect: '16:9' | '9:16' | '1:1';
    levels?: MixLevels;
  }): Promise<{ buffer: Buffer; mimeType: string; workDir: string }> {
    await this.assertAvailable();
    const workDir = join(tmpdir(), `creative-ffmpeg-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const { width, height } = this.size(input.aspect);
    const levels = input.levels || { voice: 1, music: 0.15 };
    const sceneFiles: string[] = [];
    try {
      for (const [index, clip] of input.clips.entries()) {
        const out = join(workDir, `scene-${index}.mp4`);
        if (clip.videoPath) {
          const args = ['-y', '-i', clip.videoPath];
          if (clip.audioPath) args.push('-i', clip.audioPath, '-map', '0:v:0', '-map', '1:a:0', '-shortest');
          args.push(
            '-vf',
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            out,
          );
          await this.run(args);
        } else if (clip.imagePath) {
          const args = ['-y', '-loop', '1', '-t', String(clip.durationSec), '-i', clip.imagePath];
          if (clip.audioPath) args.push('-i', clip.audioPath);
          args.push(
            '-vf',
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-shortest',
            out,
          );
          if (clip.audioPath) args.splice(args.length - 1, 0, '-c:a', 'aac');
          await this.run(args);
        } else {
          throw new ProviderError(GENERATION_FAILED, `المشهد ${index + 1} بلا صورة أو فيديو للتركيب.`, 400);
        }
        sceneFiles.push(out);
      }

      const concatList = join(workDir, 'concat.txt');
      await writeFile(concatList, sceneFiles.map((file) => `file '${file.replace(/\\/g, '/')}'`).join('\n'));
      const concatOut = join(workDir, 'concat.mp4');
      await this.run(['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', concatOut]);

      const mixed = join(workDir, 'final.mp4');
      const mixArgs = ['-y', '-i', concatOut];
      if (input.musicPath) {
        mixArgs.push(
          '-i',
          input.musicPath,
          '-filter_complex',
          `[0:a]volume=${levels.voice}[v];[1:a]volume=${levels.music}[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2,dynaudnorm[a]`,
          '-map',
          '0:v:0',
          '-map',
          '[a]',
        );
      }
      if (input.captionAssPath) {
        mixArgs.push('-vf', `ass=${input.captionAssPath.replace(/\\/g, '/')}`);
      }
      mixArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mixed);
      await this.run(mixArgs);

      const buffer = await readFile(mixed);
      return { buffer, mimeType: 'video/mp4', workDir };
    } catch (error) {
      await this.cleanup(workDir);
      throw error;
    }
  }

  async cleanup(workDir: string) {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }

  writeTempFile(workDir: string, name: string, buffer: Buffer) {
    const path = join(workDir, name);
    return writeFile(path, buffer).then(() => path);
  }

  private size(aspect: string) {
    if (aspect === '9:16') return { width: 1080, height: 1920 };
    if (aspect === '1:1') return { width: 1080, height: 1080 };
    return { width: 1920, height: 1080 };
  }

  private run(args: string[], timeoutMs = 180_000) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', args, { windowsHide: true });
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new ProviderError(GENERATION_FAILED, 'انتهت مهلة FFmpeg.', 504));
      }, timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        this.logger.warn(JSON.stringify({ event: 'FFMPEG_SPAWN_FAILED' }));
        reject(new ProviderError(FFMPEG_NOT_AVAILABLE, 'تعذر تشغيل FFmpeg.', 503));
        void error;
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new ProviderError(GENERATION_FAILED, 'فشل تركيب الفيديو عبر FFmpeg.', 500));
      });
    });
  }

  createWriteStream(path: string) {
    return createWriteStream(path);
  }
}
