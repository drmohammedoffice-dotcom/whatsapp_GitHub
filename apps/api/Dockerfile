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

RUN pnpm install --frozen-lockfile

# Generate the Prisma client, build shared deps, then build only the API.
RUN pnpm --filter @watsapp/database prisma:generate \
 && pnpm --filter @watsapp/shared build \
 && pnpm --filter @watsapp/database build \
 && pnpm --filter @watsapp/api build

# ---------------------------------------------------------------------------
# Runtime stage: apply pending Prisma migrations, then start the API.
# `prisma migrate deploy` only runs reviewed migrations from
# packages/database/prisma/migrations and never drops data on its own. Never use
# `db push --accept-data-loss` here: it silently drops tables/columns that are not
# in schema.prisma (it would delete paying customers' data).
# The API reads process.env.PORT; CORS_ORIGINS must include the web app's public URL.
# ---------------------------------------------------------------------------
FROM build AS runner
ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @watsapp/database exec prisma migrate deploy && pnpm --filter @watsapp/api start"]
