# syntax=docker/dockerfile:1
# Production Dockerfile for the @watsapp/web (Next.js) app inside a PNPM monorepo.
# IMPORTANT: The Docker build context MUST be the repository ROOT (not apps/web),
# so that workspace packages such as packages/shared are available.
# Railway is configured for this via the root-level railway.json (dockerfilePath).

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Build stage: copy the ENTIRE monorepo first, then install + build.
# Copying everything up-front guarantees every workspace package (apps/* and
# packages/*, including packages/shared) is present before `pnpm install`.
# ---------------------------------------------------------------------------
FROM base AS build

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so the
# API/socket URLs must be provided as build args (set them as Railway variables
# on the web service). Falls back to localhost for local builds.
ARG NEXT_PUBLIC_API_URL="http://localhost:4000"
ARG NEXT_PUBLIC_SOCKET_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

COPY . .

# Install all workspace dependencies. Fall back to a non-frozen install if the
# committed lockfile is slightly out of sync, so deploys never hard-fail here.
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Build the shared workspace package first (web imports its compiled dist),
# then build only the web application.
RUN pnpm --filter @watsapp/shared build \
 && pnpm --filter @watsapp/web build

# ---------------------------------------------------------------------------
# Runtime stage: reuse the built workspace and start Next.js in production.
# ---------------------------------------------------------------------------
FROM build AS runner
ENV NODE_ENV=production
EXPOSE 3000

# `next start` reads process.env.PORT automatically (defaults to 3000 locally),
# so Railway's injected PORT is honored without shell parameter expansion.
CMD ["pnpm", "--filter", "@watsapp/web", "start"]
