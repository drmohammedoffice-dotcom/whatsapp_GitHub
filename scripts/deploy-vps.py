#!/usr/bin/env python3
"""Deploy TikTok Login Kit changes to production VPS via SFTP + SSH."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/tiktok",
    "apps/api/src/integrations",
    "apps/api/src/channels",
    "apps/api/src/main.ts",
    "apps/api/src/config/env.ts",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260701120000_tiktok_login_business",
    "packages/database/prisma/migrations/20260702140000_tiktok_marketing_oauth",
    "packages/database/prisma/migrations/20260703120000_meta_oauth_tokens",
    "apps/web/src/app/settings/integrations/page.tsx",
    "apps/web/src/app/settings/tiktok-business/page.tsx",
    "apps/web/src/app/settings/page.tsx",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file() and "node_modules" not in path.parts:
                    arc = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
                    pairs.append((path, arc))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def make_tarball(pairs: list[tuple[Path, str]]) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
    return tar_path


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {command}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe = out.encode("ascii", errors="replace").decode("ascii")
        print(safe.rstrip())
    if err.strip():
        safe_err = err.encode("ascii", errors="replace").decode("ascii")
        print(safe_err.rstrip(), file=sys.stderr)
    return code, out, err


def main() -> int:
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Created tarball with {len(pairs)} files: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-update.tar.gz"
    print(f"Uploading to {remote_tar}...")
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    commands = f"""
set -e
cd {PROJECT_DIR}
echo "==> Extracting updated files..."
tar xzf deploy-update.tar.gz
rm -f deploy-update.tar.gz

echo "==> Checking Meta public routes on server..."
grep -n "api/auth/meta/callback" apps/api/src/main.ts | head -1 || (echo "ERROR: Meta callback not in main.ts excludes" && exit 1)
test -f apps/api/src/integrations/meta/meta-public.controller.ts || (echo "ERROR: meta-public.controller.ts missing" && exit 1)

echo "==> Checking TikTok Marketing OAuth on server..."
grep -n "portal/auth" apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts | head -1 || (echo "ERROR: Marketing OAuth URL missing" && exit 1)

echo "==> Running database migrations..."
pnpm prisma:migrate deploy 2>/dev/null || npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

echo "==> Generating Prisma client..."
pnpm prisma:generate

echo "==> Building API..."
pnpm --filter @watsapp/api build

echo "==> Building web..."
pnpm --filter @watsapp/web build

echo "==> Restarting PM2..."
pm2 restart api web worker --update-env
pm2 list

echo "==> Clear invalid team TikTok credentials (email saved as client key)..."
psql postgresql://postgres:postgres@localhost:5432/watsapp -c 'DELETE FROM "TikTokAppCredentials";' 2>/dev/null || true

echo "==> Health check..."
curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health || curl -sS http://127.0.0.1:4000/api/v1/health

echo "==> TikTok Business callback route (expect 302 redirect, not 404)..."
curl -sS -o /dev/null -w "tiktok-business:%{{http_code}}\\n" "https://almutamayiziq.com/api/auth/tiktok-business/callback?state=test"

echo "==> Meta OAuth callback route (expect 302 redirect, not 404)..."
curl -sS -o /dev/null -w "meta-callback:%{{http_code}}\\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"

echo "==> Meta webhook verify route (expect 403 without valid token)..."
curl -sS -o /dev/null -w "meta-webhook:%{{http_code}}\\n" "https://almutamayiziq.com/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=123"

echo "DEPLOY_COMPLETE"
"""
    code, out, err = run_remote(client, commands, timeout=900)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
