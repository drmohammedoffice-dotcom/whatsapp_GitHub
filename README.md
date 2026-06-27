# WhatsApp SaaS Milestone

Production-oriented multi-tenant WhatsApp integration platform built with Next.js 15, NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.io, and Baileys.

## Deploy to Railway via GitHub

This is a pnpm monorepo with three deployable services. Deploy each as a separate Railway service using its Dockerfile:

| Service | Dockerfile | Start command |
| --- | --- | --- |
| Web (Next.js) | `apps/web/Dockerfile` | `pnpm --filter @watsapp/web start` |
| API (NestJS) | `apps/api/Dockerfile` | `pnpm --filter @watsapp/api start` |
| Worker (BullMQ) | `apps/worker/Dockerfile` | `pnpm --filter @watsapp/worker start` |

Steps:

1. Push this repository to GitHub (see below).
2. In Railway: **New Project → Deploy from GitHub repo** and pick this repo.
3. Add a **PostgreSQL** and a **Redis** plugin to the project.
4. For each service, set **Settings → Build → Dockerfile Path** to the table above, then add the environment variables from `.env.example` (use the Railway Postgres/Redis connection strings for `DATABASE_URL` and `REDIS_URL`).
5. For the **Web** service, set the build args / variables `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the public URL of the **API** service.

> The root `railway.json` defaults to building the Web Dockerfile. Override the Dockerfile path per service for API and Worker.

## Prerequisites

- Node.js 22+
- Corepack enabled: `corepack enable`
- Docker Desktop for PostgreSQL and Redis

## Setup

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm prisma:generate
docker compose up -d postgres redis
pnpm prisma:migrate
pnpm dev
```

API: http://localhost:4000/api/v1
Swagger: http://localhost:4000/docs
Web: http://localhost:3000

## First Milestone Flow

1. Register a user and team in the web app or `POST /api/v1/auth/register`.
2. Create a WhatsApp session from the dashboard.
3. Scan the QR with WhatsApp mobile.
4. Create an API key in the dashboard.
5. Use the API key with `x-api-key` to call messaging endpoints.

## Messaging Endpoints

All messaging endpoints require `x-api-key`.

- `POST /api/v1/send-message`
- `POST /api/v1/send-image`
- `POST /api/v1/send-document`
- `POST /api/v1/send-audio`
- `POST /api/v1/send-video`
- `POST /api/v1/send-location`
- `POST /api/v1/send-contact`
- `GET /api/v1/messages`
- `GET /api/v1/chats`

Example:

```bash
curl -X POST http://localhost:4000/api/v1/send-message \
  -H "content-type: application/json" \
  -H "x-api-key: wsp_live_xxx" \
  -d '{"to":"15551234567","text":"Hello from the API"}'
```

## Security Notes

- WhatsApp session credentials are encrypted with AES-256-GCM before database persistence.
- Passwords use bcrypt.
- Refresh/reset tokens are stored as SHA-256 hashes.
- API keys are stored as peppered HMAC hashes and only shown once.
- Webhook deliveries are signed with `x-watsapp-signature`.
- All tenant resources are team-scoped.

## Production Readiness Checklist

Before deploying publicly, replace all `.env` secrets, configure a real email provider for password reset delivery, move local media/session storage to S3-compatible storage, add TLS termination, configure persistent Docker volumes or managed Postgres/Redis, and connect CI to `pnpm typecheck`, `pnpm test`, and migration checks.

## Omnichannel Core Dashboard

The platform now exposes a channel-agnostic core on top of the WhatsApp Baileys adapter:

- `/inbox` for realtime conversations, replies, assignment workflows, notes, internal comments, pinned/archived/unread filters, and status changes.
- `/customers` for customer profiles, channel identities, labels, history, and timeline context.
- `/agents` for team members, roles, permissions, agent status, and departments.
- `/analytics` for conversation volume, response time, open/closed counts, and agent workload data.
- `/settings` for WhatsApp QR/channel management, API keys, webhooks, and notifications.

Core dashboard APIs use JWT bearer auth. External messaging APIs continue to use `x-api-key`. WhatsApp is the first production channel; new providers should implement the channel adapter boundary and write into `Channel`, `ContactIdentity`, `Conversation`, and `ConversationMessage` rather than creating provider-specific inbox tables.

Realtime Socket.io rooms:

- `team:{teamId}` for inbox, channel, contact, analytics, and settings updates.
- `user:{userId}` for notifications and assignments.
- `conversation:{conversationId}` for active conversation thread events.

## AI-Powered Communication Platform

The AI milestone adds an OpenAI-compatible provider abstraction with pgvector-backed RAG, encrypted AI memory, AI inbox assists, function tools, voice, OCR, and governance.

### AI Setup

Use a provider that implements OpenAI-compatible endpoints:

```bash
AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=replace-with-provider-key
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536
```

The local Postgres image is `pgvector/pgvector:pg16`. Apply Prisma migrations so the `vector` extension and `ai_knowledge_embedding` table exist before indexing knowledge.

### AI Capabilities

- `POST /api/v1/ai/chat` for RAG-enabled AI chat.
- `POST /api/v1/ai/knowledge/text`, `/faq`, `/crawl`, `/document` for knowledge ingestion.
- `POST /api/v1/ai/search` for semantic search over indexed chunks.
- `POST /api/v1/ai/rewrite`, `/translate`, `/sentiment`, `/intent`, `/spam`, `/lead-qualification`, `/classification`, `/smart-routing` for inbox assistance.
- `POST /api/v1/ai/conversations/:id/suggest-reply` and `/summarize` for conversation AI.
- `GET/POST /api/v1/ai/memory` for encrypted conversation/customer/business/long-term memory.
- `GET/POST /api/v1/ai/tools` and `POST /api/v1/ai/tools/:id/execute` for HTTP/custom API function tools.
- `POST /api/v1/ai/voice/transcribe`, `/voice/speech`, and `/ocr` for voice and image/document AI.
- `GET /api/v1/ai/costs` for AI cost monitoring.

### AI Governance

AI endpoints require JWT auth and AI-specific permissions: `AI_ACCESS`, `AI_MANAGE_KNOWLEDGE`, `AI_MANAGE_TOOLS`, and `AI_VIEW_COSTS`. AI memories and tool configs are encrypted at rest using the existing encryption service. AI runs record token/cost metadata and audit logs.

### Deployment

CI lives in `.github/workflows/ci.yml`. Kubernetes manifests are under `deploy/kubernetes/` and include pgvector Postgres, Redis, API, Web, ConfigMap, and Secret templates. For production, replace all secrets, use managed Postgres/Redis where possible, and run separate worker deployments for high-volume ingestion/audio/OCR workloads.

## Production Hardening Added

This project now separates request-serving and background processing:

- `@watsapp/api` serves HTTP/WebSocket traffic only.
- `@watsapp/worker` processes BullMQ jobs such as signed webhook delivery.
- Run locally with `pnpm dev` or Docker Compose; both include the worker.
- Kubernetes manifests include `deploy/kubernetes/worker.yml` and API readiness probes use `/api/v1/health/ready`.

Operational endpoints:

- `GET /api/v1/health` for liveness.
- `GET /api/v1/health/ready` for database/Redis readiness.

Every API response includes `x-request-id`; clients can pass their own `x-request-id` to correlate logs, traces, and support tickets.

Scaling guidance:

- Scale `api` horizontally for HTTP/WebSocket traffic.
- Scale `worker` horizontally for webhook, AI ingestion, OCR/audio, and future queue workloads.
- Keep queue processors out of API deployments to avoid duplicate work and noisy latency.
