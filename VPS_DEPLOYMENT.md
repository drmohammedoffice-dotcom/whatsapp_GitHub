# VPS Deployment Guide (Contabo)

Deploy the whole platform on a single Contabo VPS using Docker Compose. Caddy
terminates HTTPS automatically (Let's Encrypt), so you don't manage certs.

```
Internet ──► Caddy (80/443)
                ├─ https://app.example.com ─► web    (Next.js)
                └─ https://api.example.com ─► api    (NestJS + WebSocket)
                                               worker (background jobs)
                                               postgres + redis (internal only)
```

## 0. What you need

- A Contabo VPS (Ubuntu 22.04/24.04). Minimum 4 GB RAM (8 GB recommended — the
  Next.js + Prisma build is memory-hungry).
- A domain name with access to its DNS records.

## 1. Point DNS at the VPS

Create two **A records** pointing to your VPS public IP:

| Type | Name | Value          |
| ---- | ---- | -------------- |
| A    | app  | `<VPS_IP>`     |
| A    | api  | `<VPS_IP>`     |

(So `app.example.com` and `api.example.com` both resolve to the server.)

## 2. Install Docker on the VPS

SSH in (`ssh root@<VPS_IP>`) and run:

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

## 3. Get the code onto the server

Option A — clone from GitHub (recommended):

```bash
cd /opt
git clone https://github.com/<USERNAME>/<REPO>.git watsapp
cd watsapp
```

Option B — upload via SCP from your PC (run on your PC, not the server):

```bash
scp -r c:\xampp\htdocs\watsapp root@<VPS_IP>:/opt/watsapp
```

## 4. Configure environment

```bash
cd /opt/watsapp
cp .env.production.example .env
nano .env
```

Edit these in `.env`:

- `APP_DOMAIN`, `API_DOMAIN` — your real subdomains.
- `API_PUBLIC_URL`, `WEB_PUBLIC_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SOCKET_URL` — use the same `https://` domains.
- `POSTGRES_PASSWORD` and the same password inside `DATABASE_URL`.
- All five secrets (each ≥ 32 chars). Generate with:

```bash
openssl rand -hex 32
```

- `AI_API_KEY` — your OpenAI-compatible key (optional, for AI features).

## 5. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes several minutes. The `api` container runs `prisma db push`
automatically on boot to create the database schema.

Check status and logs:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

## 6. Verify

- `https://api.example.com/api/v1/health` → `{"status":"ok"}`
- `https://api.example.com/docs` → Swagger UI
- `https://app.example.com` → app loads, login works (no "Server offline").

Caddy fetches certificates on first request; allow a minute and ensure ports
**80 and 443** are open in the Contabo firewall / VPS firewall.

## 7. Day-2 operations

Update to the latest code:

```bash
cd /opt/watsapp
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

> If you change any `NEXT_PUBLIC_*` value, rebuild the web image (it bakes those
> at build time): `docker compose -f docker-compose.prod.yml up -d --build web`.

View logs / restart a single service:

```bash
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml restart api
```

Stop everything (data is preserved in named volumes):

```bash
docker compose -f docker-compose.prod.yml down
```

## 8. Backups

Persistent data lives in Docker volumes (`postgres_data`, `redis_data`) and the
`./storage` folder (WhatsApp sessions + uploaded media). Back up the database:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U watsapp watsapp > backup_$(date +%F).sql
```

Also archive `./storage` regularly:

```bash
tar czf storage_$(date +%F).tar.gz storage
```

## Firewall (recommended)

Only expose SSH + HTTP + HTTPS:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Postgres (5432) and Redis (6379) are **not** published to the host in
`docker-compose.prod.yml`, so they remain private to the Docker network.
