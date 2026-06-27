# syntax=docker/dockerfile:1
# Production Dockerfile for the @watsapp/api (NestJS) app inside a PNPM monorepo.
# IMPORTANT: The Docker build context MUST be the repository ROOT (not apps/api),
# so that workspace packages (packages/database, packages/shared) are available.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# OpenSSL is required by Prisma engines on Alpine.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Build stage: copy the ENTIRE monorepo, install, generate Prisma client, build.
# ---------------------------------------------------------------------------
FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Generate the Prisma client, build shared deps, then build only the API.
RUN pnpm --filter @watsapp/database prisma:generate \
 && pnpm --filter @watsapp/shared build \
 && pnpm --filter @watsapp/database build \
 && pnpm --filter @watsapp/api build

# ---------------------------------------------------------------------------
# Runtime stage: sync the schema to the database, then start the API.
# This project uses `prisma db push` as the schema source of truth; the pgvector
# extension + embedding table are applied via raw SQL (non-fatal so the API
# still boots on a Postgres without the vector extension available).
# The API reads process.env.PORT (Railway injects it); CORS_ORIGINS must include
# the web app's public URL.
# ---------------------------------------------------------------------------
FROM build AS runner
ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @watsapp/database exec prisma db push --skip-generate --accept-data-loss && (pnpm --filter @watsapp/database exec prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260625223000_ai_pgvector/migration.sql || echo 'pgvector step skipped') && pnpm --filter @watsapp/api start"]
