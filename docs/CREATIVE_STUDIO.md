# Creative Studio (Phase 4)

Chatloora → Creative Studio → Orchestrator → OpenAI (brain) / OpenRouter (media) → BullMQ `creative-pipeline` → **apps/worker** → StorageProvider → generated assets / FFmpeg compose.

The API authenticates, authorizes, creates jobs, and reads status. Long-running generation, polling, TTS, FFmpeg, and downloads run in `apps/worker`.

## Capability status

| Capability | Status |
| --- | --- |
| Product intelligence | IMPLEMENTED + NOT LIVE TESTED in this phase (OpenAI when configured) |
| Real image generation | IMPLEMENTED + NOT LIVE TESTED in this phase (OpenRouter / OpenAI Images) |
| Async video + polling | IMPLEMENTED + NOT LIVE TESTED (OpenRouter Videos when a model supports the mode) |
| Scene timeline / scripts | IMPLEMENTED + NOT LIVE TESTED |
| Natural-language edit director | IMPLEMENTED (structured parse; no silent preservation if the model cannot guarantee it) |
| Version history | IMPLEMENTED + NOT LIVE TESTED |
| OpenAI TTS (MSA / generic) | IMPLEMENTED + NOT LIVE TESTED — **never labeled Iraqi** |
| Iraqi Arabic TTS | NOT CONFIGURED (`IRAQI_TTS_NOT_CONFIGURED`) |
| Lip-sync | NOT CONFIGURED (`LIPSYNC_NOT_CONFIGURED`) |
| Licensed music catalog | NOT CONFIGURED — user upload with rights confirmation only |
| FFmpeg compose | IMPLEMENTED + NOT LIVE TESTED (requires `ffmpeg` on the worker host) |
| Native 4K | Only if output pixels ≥ 3840×2160 |
| 4K upscale | NOT CONFIGURED (`4K_UPSCALE_NOT_CONFIGURED`) |
| Admin model panel | IMPLEMENTED (no API keys in config rows) |
| Quotas + concurrent reservation | IMPLEMENTED (advisory lock + in-flight jobs) |

## Environment (server-side only)

```
OPENAI_API_KEY=
OPENROUTER_API_KEY=
CREATIVE_OPENAI_TEXT_MODEL=gpt-4o
CREATIVE_OPENAI_IMAGE_MODEL=gpt-image-2
CREATIVE_OPENAI_TTS_MODEL=tts-1
```

Never put keys in the frontend, Git, logs, `.env.example` values, or `CreativeStudioModelConfig`.

## Worker

Start the worker process so `creative-pipeline` jobs are consumed:

```
pnpm --filter @watsapp/worker start
```

(or the repository’s worker start script). The API must **not** register `CreativeStudioProcessor`.

## Migrations

```
pnpm --filter @watsapp/database prisma:migrate
```

New migration: `20260909030000_creative_studio_phase4`. Do not edit older Creative Studio migrations.

## Failure codes (additive)

`IRAQI_TTS_NOT_CONFIGURED`, `LIPSYNC_NOT_CONFIGURED`, `MUSIC_NOT_CONFIGURED`, `4K_UPSCALE_NOT_CONFIGURED`, `FFMPEG_NOT_AVAILABLE`, plus Phase 3 codes.

## Tests

```
pnpm --filter @watsapp/api test -- creative
```

Live provider generation is not invoked in CI.
