# syntax=docker/dockerfile:1
# Production Dockerfile for the @watsapp/worker (background jobs) app.
# IMPORTANT: The Docker build context MUST be the repository ROOT (not apps/worker),
# so that workspace packages (packages/database, packages/shared) are available.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /app

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

RUN pnpm --filter @watsapp/database prisma:generate \
 && pnpm --filter @watsapp/shared build \
 && pnpm --filter @watsapp/database build \
 && pnpm --filter @watsapp/worker build

FROM build AS runner
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@watsapp/worker", "start"]
