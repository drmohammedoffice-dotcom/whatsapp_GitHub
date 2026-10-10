# -*- coding: utf-8 -*-
"""ChatLoora reel: fake TikTok readings, locked placements, Iraqi voice, music."""
import math
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import render_reel as r

ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(ROOT, "voice")
OUT = os.path.join(ROOT, "chatloora-tiktok-reel.mp4")
PREVIEW = os.path.join(ROOT, "preview")
SR = 44100
FPS = 30
GAP = 0.12
LEAD = 0.18
TAIL = 0.75


def decode_mp3(path):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.run(
        [ffmpeg, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    )
    audio = np.frombuffer(proc.stdout, dtype=np.float32).copy()
    peak = float(np.max(np.abs(audio))) if audio.size else 1.0
    if peak > 0:
        audio *= 0.92 / peak
    return audio


def build_voice():
    parts = []
    cues = []
    cursor = int(LEAD * SR)
    parts.append(np.zeros(cursor, np.float32))
    for i in range(10):
        clip = decode_mp3(os.path.join(VOICE_DIR, f"line-{i:02d}.mp3"))
        start = cursor / SR
        parts.append(clip)
        cursor += clip.size
        cues.append((start, cursor / SR))
        if i < 9:
            gap = np.zeros(int(GAP * SR), np.float32)
            parts.append(gap)
            cursor += gap.size
    parts.append(np.zeros(int(TAIL * SR), np.float32))
    voice = np.concatenate(parts)
    return voice, cues


def tone(freq, seconds, decay):
    n = int(seconds * SR)
    t = np.arange(n, dtype=np.float32) / SR
    wave_ = np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)
    return wave_.astype(np.float32)


def make_music(n):
    music = np.zeros(n, np.float32)
    bpm = 96
    beat = 60.0 / bpm
    beat_n = int(beat * SR)
    kick = tone(58, 0.22, 14) * np.linspace(1, 0.2, int(0.22 * SR), dtype=np.float32)
    # pitch drop
    kn = kick.size
    kt = np.arange(kn, dtype=np.float32) / SR
    kick = np.sin(2 * np.pi * (90 * np.exp(-kt * 16) + 46) * kt).astype(np.float32) * np.exp(-kt * 9)
    hat_n = int(0.04 * SR)
    hat = (np.random.default_rng(3).standard_normal(hat_n).astype(np.float32)) * np.exp(-np.arange(hat_n) / (SR * 0.008))
    notes = [293.66, 369.99, 392.00, 440.00, 392.00, 369.99, 311.13, 293.66]
    total_beats = int(n / beat_n) + 1
    for i in range(total_beats):
        at = i * beat_n
        if at >= n:
            break
        if i % 2 == 0:
            end = min(n, at + kick.size)
            music[at:end] += kick[: end - at] * 0.55
        if i % 4 == 2:
            clap_n = int(0.12 * SR)
            ct = np.arange(clap_n, dtype=np.float32) / SR
            noise = np.random.default_rng(10 + i).standard_normal(clap_n).astype(np.float32)
            clap = noise * np.exp(-ct * 22)
            end = min(n, at + clap.size)
            music[at:end] += clap[: end - at] * 0.18
        if i % 2 == 1:
            end = min(n, at + hat.size)
            music[at:end] += hat[: end - at] * 0.07
        if i % 2 == 0:
            freq = notes[(i // 2) % len(notes)]
            pluck = tone(freq, 0.28, 8) * 0.16
            end = min(n, at + pluck.size)
            music[at:end] += pluck[: end - at]
    # soft low root
    t = np.arange(n, dtype=np.float32) / SR
    music += 0.05 * np.sin(2 * np.pi * 73.4 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * t / (beat * 4)))
    music = np.tanh(music * 1.3).astype(np.float32)
    return music


def mix(voice, music):
    n = min(voice.size, music.size)
    voice = voice[:n]
    music = music[:n]
    env = np.abs(voice)
    win = int(0.06 * SR)
    kernel = np.ones(win, np.float32) / win
    env = np.convolve(env, kernel, mode="same")
    scale = np.percentile(env, 92) + 1e-6
    env = np.clip(env / scale, 0, 1)
    ducked = music * (0.34 - 0.24 * env)
    left = voice * 1.05 + ducked
    right = voice * 1.05 + ducked * 0.96
    stereo = np.stack([left, right], axis=1)
    peak = float(np.max(np.abs(stereo)))
    if peak > 0.98:
        stereo *= 0.98 / peak
    return stereo.astype(np.float32)


def write_wav(path, stereo):
    pcm = np.clip(stereo, -1, 1)
    ints = (pcm * 32767).astype(np.int16)
    with wave.open(path, "w") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(ints.tobytes())


def circle_icon(draw_fn, fill, label, locked=False):
    size = 132
    img = Image.new("RGBA", (168, 230), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((18, 8, 150, 140), fill=fill)
    draw_fn(d)
    if locked:
        d.rounded_rectangle((108, 96, 156, 144), radius=14, fill=(20, 8, 16, 230))
        d.rounded_rectangle((122, 108, 142, 128), radius=4, outline=(255, 255, 255, 255), width=3)
        d.arc((120, 96, 144, 120), 200, 340, fill=(255, 255, 255, 255), width=3)
    name = r.fit_text(label, 28, r.WHITE if not locked else r.AMBER, 160, "bold")
    img.alpha_composite(name, ((168 - name.width) // 2, 168))
    return img


def icon_note(d):
    d.ellipse((58, 78, 82, 102), fill=(255, 255, 255, 255))
    d.rectangle((78, 42, 88, 88), fill=(255, 255, 255, 255))
    d.polygon([(88, 42), (112, 52), (88, 64)], fill=(255, 255, 255, 255))


def icon_grid(d):
    for x in (48, 78):
        for y in (36, 66):
            d.rounded_rectangle((x, y, x + 24, y + 24), radius=5, fill=(255, 255, 255, 230))


def icon_globe(d):
    d.ellipse((50, 38, 118, 106), outline=(255, 255, 255, 240), width=5)
    d.arc((68, 38, 100, 106), 0, 360, fill=(255, 255, 255, 220), width=4)
    d.line([(50, 72), (118, 72)], fill=(255, 255, 255, 220), width=4)


def icon_play(d):
    d.polygon([(58, 40), (58, 104), (112, 72)], fill=(255, 255, 255, 240))


def stamp_image():
    word = r.text_image("وهمية", 64, (255, 255, 255, 255), "bold")
    pad = 22
    img = Image.new("RGBA", (word.width + pad * 2, word.height + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, img.width - 3, img.height - 3), radius=16, outline=(251, 113, 133, 255), width=6)
    img.alpha_composite(word, (pad, pad))
    return img.rotate(-12, expand=True, resample=Image.Resampling.BICUBIC)


class Ad:
    def __init__(self, cues, duration):
        self.cues = cues
        self.duration = duration
        self.base = r.Reel()
        self.stamp = stamp_image()
        self.icons = [
            circle_icon(icon_note, (18, 18, 22, 255), "تيك توك", False),
            circle_icon(icon_grid, (70, 40, 140, 255), "تطبيقات", True),
            circle_icon(icon_globe, (160, 90, 20, 255), "شبكة", True),
            circle_icon(icon_play, (20, 90, 110, 255), "أخرى", True),
        ]
        self.only = circle_icon(icon_note, (18, 18, 22, 255), "تيك توك", False)

    def span(self, a, b):
        return self.cues[a][0], self.cues[b][1]

    def frame(self, t):
        frame = self.base.backdrop(t)
        scenes = [
            (*self.span(0, 0), self.scene_hook),
            (*self.span(1, 2), self.scene_locked),
            (*self.span(3, 3), self.scene_count),
            (*self.span(4, 4), self.scene_brand),
            (*self.span(5, 7), self.scene_steps),
            (*self.span(8, 8), self.scene_real),
            (*self.span(9, 9), self.scene_cta),
        ]
        # hold CTA through the tail
        scenes[-1] = (scenes[-1][0], self.duration, scenes[-1][2])
        hero = False
        mark = 0
        for start, end, fn in scenes:
            a, local, dy = r.window(t, start, end, fade_s=0.22, fade_out=end < self.duration - 0.2)
            if a <= 0:
                continue
            if fn in (self.scene_brand, self.scene_cta):
                hero = True
            else:
                mark = max(mark, a)
            fn(frame, t, a, local, dy, start, end)
        if mark > 0 and not hero:
            self.base.watermark(frame, mark)
        return frame

    def scene_hook(self, frame, t, a, local, dy, start, end):
        k = r.fit_text("إعلانات تيك توك", 36, r.CYAN, 900, "med")
        r.blit_center(frame, k, r.W / 2, 360 + dy, a)
        title = r.fit_text("قراءات وهمية؟", 92, r.WHITE, 980)
        r.blit_center(frame, title, r.W / 2, 430 + dy, a)
        value = int(12000 + (84600 - 12000) * r.ease_out(min(1, local / 0.55)))
        num = r.text_image(f"{value:,}", 110, r.AMBER, "latin")
        r.blit_center(frame, num, r.W / 2, 620 + dy, a)
        cap = r.fit_text("الرقم الكبير ما يعني تيك توك", 36, r.MUTED, 920, "med")
        r.blit_center(frame, cap, r.W / 2, 800 + dy, a)
        if local > 0.42:
            pop = r.ease_out((local - 0.42) / 0.2)
            stamp = self.stamp
            if pop < 0.98:
                s = 1.18 - 0.18 * pop
                stamp = stamp.resize((max(1, int(stamp.width * s)), max(1, int(stamp.height * s))), Image.Resampling.BICUBIC)
            r.blit_center(frame, stamp, r.W / 2, 920 + dy, a * pop)

    def scene_locked(self, frame, t, a, local, dy, start, end):
        line2 = self.cues[2][0]
        title = r.fit_text("منصات ثانية ما تنحذف", 68, r.WHITE, 980)
        r.blit_center(frame, title, r.W / 2, 300 + dy, a)
        sub = r.fit_text("تطلع جنب تيك توك داخل الحملة", 36, r.MUTED, 940, "med")
        r.blit_center(frame, sub, r.W / 2, 400 + dy, a)
        shake = int(math.sin(t * 26) * 7) if t >= line2 else 0
        card = r.glass(940, 520, 36)
        head = r.fit_text("مواضع الإعلان", 34, r.CYAN, 800, "med")
        card.alpha_composite(head, ((card.width - head.width) // 2, 28))
        row_w = sum(icon.width for icon in self.icons) + 12 * 3
        x = (card.width - row_w) // 2
        for icon in self.icons:
            card.alpha_composite(icon, (x, 110))
            x += icon.width + 12
        note = r.fit_text("ما تكدر تشيلها", 40, r.RED, 800, "bold")
        card.alpha_composite(note, ((card.width - note.width) // 2, 400))
        r.blit_center(frame, card, r.W / 2 + shake, 500 + dy, a)

    def scene_count(self, frame, t, a, local, dy, start, end):
        title = r.fit_text("المشاهدة مو على تيك توك", 64, r.WHITE, 980)
        r.blit_center(frame, title, r.W / 2, 320 + dy, a)
        bad = r.round_rect(860, 200, 28, (80, 24, 40, 220), r.RED + (180,), 2)
        good = r.round_rect(860, 200, 28, (255, 255, 255, 16), (255, 255, 255, 40), 2)
        b1 = r.text_image("منصة ثانية", 40, r.WHITE, "bold")
        b2 = r.text_image("مشاهدة وهمية", 36, r.AMBER, "bold")
        b3 = r.text_image("84,600", 36, r.AMBER, "latin")
        bad.alpha_composite(b1, (bad.width - b1.width - 36, 36))
        bad.alpha_composite(b3, (bad.width - b2.width - b3.width - 48, 108))
        bad.alpha_composite(b2, (bad.width - b2.width - 36, 108))
        g1 = r.text_image("تيك توك", 40, r.WHITE, "bold")
        g2 = r.text_image("ما انحسبت عليه", 36, r.MUTED, "med")
        good.alpha_composite(g1, (good.width - g1.width - 36, 40))
        good.alpha_composite(g2, (good.width - g2.width - 36, 110))
        r.blit_center(frame, bad, r.W / 2, 500 + dy, a)
        r.blit_center(frame, good, r.W / 2, 740 + dy, a * r.ease_out(min(1, local / 0.25)))
        foot = r.fit_text("لهذا القراءة تكون وهمية", 36, r.RED, 900, "med")
        r.blit_center(frame, foot, r.W / 2, 1020 + dy, a)

    def scene_brand(self, frame, t, a, local, dy, start, end):
        hero = self.base.hero
        pop = 0.92 + 0.08 * r.ease_out(min(1, local / 0.3))
        if pop < 0.995:
            hero = hero.resize((max(1, int(hero.width * pop)), max(1, int(hero.height * pop))), Image.Resampling.LANCZOS)
        r.blit_center(frame, hero, r.W / 2, 460 + dy, a)
        title = r.fit_text("جات لورا تحل المشكلة", 64, r.WHITE, 980)
        r.blit_center(frame, title, r.W / 2, 460 + hero.height + 40 + dy, a)

    def scene_steps(self, frame, t, a, local, dy, start, end):
        title = r.fit_text("من جات لورا", 42, r.CYAN, 900, "med")
        r.blit_center(frame, title, r.W / 2, 280 + dy, a)
        head = r.fit_text("اربط وأنشئ من مكان واحد", 60, r.WHITE, 980)
        r.blit_center(frame, head, r.W / 2, 350 + dy, a)
        steps = [
            (5, "اربط حساب تيك توك الإعلاني"),
            (6, "اربط رقم واتساب"),
            (7, "أنشئ البكسل والحملة"),
        ]
        y = 520
        for index, (cue, label) in enumerate(steps):
            cue_at = self.cues[cue][0]
            shown = t >= cue_at - 0.05
            if not shown:
                continue
            appear = r.ease_out(min(1, (t - cue_at + 0.05) / 0.25))
            active = cue == 7 or (cue < 7 and t < self.cues[cue + 1][0])
            row = r.hgradient(880, 120, (88, 48, 220), (14, 140, 170), 30) if active else r.glass(880, 120, 30)
            name = r.fit_text(label, 36, r.WHITE, 680, "bold")
            badge = r.check_mark(52, r.GREEN)
            row.alpha_composite(badge, (row.width - 84, (row.height - 52) // 2))
            row.alpha_composite(name, (row.width - 110 - name.width, (row.height - name.height) // 2))
            r.blit_center(frame, row, r.W / 2, y + dy + int((1 - appear) * 20), a * appear)
            y += 150

    def scene_real(self, frame, t, a, local, dy, start, end):
        title = r.fit_text("تيك توك فقط", 86, r.WHITE, 980)
        r.blit_center(frame, title, r.W / 2, 340 + dy, a)
        big = self.only.resize((280, int(280 * self.only.height / self.only.width)), Image.Resampling.LANCZOS)
        r.blit_center(frame, big, r.W / 2, 500 + dy, a)
        pill = r.hgradient(560, 96, (16, 120, 90), (20, 160, 120), 48)
        word = r.text_image("قراءات حقيقية", 40, r.WHITE, "bold")
        pill.alpha_composite(word, ((pill.width - word.width) // 2, (pill.height - word.height) // 2))
        r.blit_center(frame, pill, r.W / 2, 860 + dy, a * r.ease_out(min(1, local / 0.3)))
        sub = r.fit_text("بدون المنصات الثانية", 36, r.GREEN, 900, "med")
        r.blit_center(frame, sub, r.W / 2, 990 + dy, a)

    def scene_cta(self, frame, t, a, local, dy, start, end):
        logo = self.base.cta_logo
        r.blit_center(frame, logo, r.W / 2, 380 + dy, a)
        title = r.fit_text("أنشئ حسابك الآن", 64, r.WHITE, 960)
        y = 380 + logo.height + 36 + dy
        r.blit_center(frame, title, r.W / 2, y, a)
        btn = r.hgradient(680, 112, (109, 40, 217), (6, 182, 212), 56)
        url = r.text_image("almutamayiziq.com", 40, r.WHITE, "latin")
        btn.alpha_composite(url, ((btn.width - url.width) // 2, (btn.height - url.height) // 2 - 2))
        r.blit_center(frame, btn, r.W / 2, y + title.height + 28, a)
        foot = r.fit_text("دعم فني متواصل", 34, r.MUTED, 900, "med")
        r.blit_center(frame, foot, r.W / 2, y + title.height + 170, a)


def render(ad, wav_path, preview=False):
    if preview:
        os.makedirs(PREVIEW, exist_ok=True)
        for i, (start, end) in enumerate(ad.cues):
            t = (start + end) / 2
            img = ad.frame(t).convert("RGB")
            path = os.path.join(PREVIEW, f"ad-{i:02d}.jpg")
            img.save(path, quality=90)
            print("preview", path, flush=True)
        return
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    frames = int(round(ad.duration * FPS))
    cmd = [
        ffmpeg, "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{r.W}x{r.H}", "-r", str(FPS), "-i", "-",
        "-i", wav_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", OUT,
    ]
    log_path = os.path.join(ROOT, "ffmpeg-log.txt")
    with open(log_path, "w", encoding="utf-8") as log:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        try:
            for i in range(frames):
                frame = ad.frame(i / FPS).convert("RGB")
                proc.stdin.write(frame.tobytes())
                if i % 45 == 0:
                    print(f"frame {i}/{frames}", flush=True)
        finally:
            proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise SystemExit(f"ffmpeg failed {code}")
    print("wrote", OUT, flush=True)


def main():
    voice, cues = build_voice()
    music = make_music(voice.size)
    stereo = mix(voice, music)
    wav_path = os.path.join(ROOT, "bed.wav")
    write_wav(wav_path, stereo)
    duration = stereo.shape[0] / SR
    for i, (a, b) in enumerate(cues):
        print(f"cue {i} {a:.2f}-{b:.2f}", flush=True)
    print(f"duration {duration:.2f}", flush=True)
    ad = Ad(cues, duration)
    render(ad, wav_path, preview="preview" in sys.argv)


if __name__ == "__main__":
    main()
