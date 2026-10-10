# -*- coding: utf-8 -*-
"""Generate the Iraqi voiceover and print each line duration."""
import asyncio
import os
import subprocess

import imageio_ffmpeg
import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.join(ROOT, "voice")
os.makedirs(VOICE_DIR, exist_ok=True)

LINES = [
    "ليش قراءات إعلانك على تيك توك وهمية؟",
    "لأن الحملة ما تنزل على تيك توك بس.",
    "منصات ثانية تطلع جنبه، وما تكدر تشيلها.",
    "والمشاهدة تنحسب على منصة ثانية، مو على تيك توك.",
    "جات لورا تحل هالمشكلة.",
    "تربط حسابك الإعلاني على تيك توك.",
    "وتربط رقم الواتساب.",
    "وتنشئ البكسل والحملة من مكان واحد.",
    "إعلانك يصير على تيك توك فقط، والقراءة تصير حقيقية.",
    "أنشئ حسابك الآن على جات لورا.",
]

VOICE = "ar-IQ-BasselNeural"


async def main():
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for i, line in enumerate(LINES):
        path = os.path.join(VOICE_DIR, f"line-{i:02d}.mp3")
        await edge_tts.Communicate(line, VOICE, rate="+6%").save(path)
        probe = subprocess.run(
            [ffmpeg, "-i", path],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        duration = "?"
        for row in probe.stderr.splitlines():
            if "Duration:" in row:
                duration = row.strip()
                break
        print(f"{i:02d}\t{duration}\t{line}")


if __name__ == "__main__":
    asyncio.run(main())
