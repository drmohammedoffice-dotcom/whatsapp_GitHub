# Railway Multi-Service Deployment Guide

This monorepo deploys as **three Railway services** from the **same GitHub repo**, plus two managed plugins (PostgreSQL + Redis).

```
Railway Project
├── Postgres        (plugin)
├── Redis           (plugin)
├── api    service  → apps/api/Dockerfile     (config: railway.api.json)
├── worker service  → apps/worker/Dockerfile  (config: railway.worker.json)
└── web    service  → apps/web/Dockerfile      (config: railway.web.json)
```

Each service points to its own config file. This is what fixes the "only the web app deploys" problem — without a per-service config path, every service falls back to the root `railway.json` (web) and you end up with three copies of the frontend.

---

## 1. Create the project and plugins

1. **New Project → Deploy from GitHub repo** → pick this repo. Railway creates the first service.
2. Click **+ New → Database → Add PostgreSQL**.
3. Click **+ New → Database → Add Redis**.

## 2. Create the three services from the same repo

You need three services all pointing to this repo. For each one: **+ New → GitHub Repo → (this repo)**. Rename them exactly: `api`, `worker`, `web`.

For each service open **Settings → Config-as-code** (a.k.a. "Railway Config File") and set the path:

| Service | Config-as-code path     |
| ------- | ----------------------- |
| `api`   | `railway.api.json`      |
| `worker`| `railway.worker.json`   |
| `web`   | `railway.web.json`      |

> The build context is always the repo root (the Dockerfiles `COPY . .`), so workspace packages (`packages/shared`, `packages/database`) are always available. Do **not** set a "Root Directory" on the services — leave it empty.

## 3. Shared variables (set once at the project level)

Open **Project → Settings → Shared Variables** and add the values below. Both `api` and `worker` need the **full** set because the worker validates the exact same env schema as the API — a missing secret will crash the worker on boot.

| Variable                 | Value / notes                                                             |
| ------------------------ | ------------------------------------------------------------------------- |
| `NODE_ENV`               | `production`                                                              |
| `DATABASE_URL`           | `${{ Postgres.DATABASE_URL }}` (reference the Postgres plugin)            |
| `REDIS_URL`              | `${{ Redis.REDIS_URL }}` (reference the Redis plugin)                     |
| `JWT_ACCESS_SECRET`      | random string, **min 32 chars**                                           |
| `JWT_REFRESH_SECRET`     | random string, **min 32 chars**                                           |
| `ENCRYPTION_KEY`         | random string, **min 32 chars**                                           |
| `API_KEY_PEPPER`         | random string, **min 32 chars**                                           |
| `WEBHOOK_SIGNING_SECRET` | random string, **min 32 chars**                                           |
| `JWT_ACCESS_TTL`         | `15m`                                                                     |
| `JWT_REFRESH_TTL_DAYS`   | `30`                                                                      |
| `LOCAL_STORAGE_ROOT`     | `/app/storage`                                                            |
| `AI_API_BASE_URL`        | `https://api.openai.com/v1` (or your OpenAI-compatible provider)          |
| `AI_API_KEY`             | your provider key (optional; defaults to `not-configured`)                |
| `AI_CHAT_MODEL`          | `gpt-4o-mini`                                                             |
| `AI_EMBEDDING_MODEL`     | `text-embedding-3-small`                                                  |
| `AI_EMBEDDING_DIMENSIONS`| `1536`                                                                    |
| `AI_AUDIO_MODEL`         | `whisper-1`                                                               |
| `AI_TTS_MODEL`           | `tts-1`                                                                   |

Generate a secret quickly (run locally and paste the output):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Per-service variables

### `api` service

| Variable          | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `API_PUBLIC_URL`  | `https://${{ RAILWAY_PUBLIC_DOMAIN }}`                           |
| `WEB_PUBLIC_URL`  | `https://${{ web.RAILWAY_PUBLIC_DOMAIN }}`                       |
| `CORS_ORIGINS`    | `https://${{ web.RAILWAY_PUBLIC_DOMAIN }}`                       |

First enable a public domain on the `api` service: **Settings → Networking → Generate Domain** (the container listens on `PORT`, which Railway injects automatically — the API reads it).

> Optional (only if you use these integrations): `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `META_VERIFY_TOKEN`, `META_APP_SECRET`.

### `worker` service

The worker needs the shared variables only. To satisfy the shared env schema, also add:

| Variable          | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `API_PUBLIC_URL`  | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}`                       |
| `WEB_PUBLIC_URL`  | `https://${{ web.RAILWAY_PUBLIC_DOMAIN }}`                       |
| `CORS_ORIGINS`    | `https://${{ web.RAILWAY_PUBLIC_DOMAIN }}`                       |

(The worker has no HTTP server; these just satisfy validation.)

### `web` service — auto-connect to the API

These two are **build-time** values (Next.js inlines `NEXT_PUBLIC_*` into the browser bundle). The web Dockerfile already declares them as `ARG`, and Railway passes service variables into the matching Docker `ARG` at build time. Using a reference variable to the `api` service domain makes the frontend connect to the Railway API automatically — no hardcoding.

| Variable                 | Value                                       |
| ------------------------ | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`    | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}`  |
| `NEXT_PUBLIC_SOCKET_URL` | `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}`  |

Then generate a public domain for the `web` service too: **Settings → Networking → Generate Domain**.

> If you change `NEXT_PUBLIC_API_URL` later, you must **redeploy the web service** (build-time values only take effect on a fresh build).

## 5. Deploy order

1. Deploy `api` first (it runs `prisma db push` on boot to create the schema).
2. Deploy `worker`.
3. Deploy `web` last (so the `api` domain already exists for the reference variable).

## 6. Verify

- `https://<api-domain>/api/v1/health` → `{"status":"ok"}`
- `https://<api-domain>/docs` → Swagger UI
- Open `https://<web-domain>` → the "Server offline" banner should be gone and login should work.

---

## Why the frontend showed "Server offline"

The browser bundle was built with the default `NEXT_PUBLIC_API_URL=http://localhost:4000` because no build-time API URL was provided. Setting `NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_SOCKET_URL`) on the `web` service to the `api` service's public domain — and redeploying — bakes the correct URL into the bundle, so the frontend talks to the Railway API instead of localhost.
