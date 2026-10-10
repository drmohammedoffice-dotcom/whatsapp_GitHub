#!/usr/bin/env python3
"""Deploy per-platform AI training to production VPS."""
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
    "apps/api/src/ai",
    "apps/web/src/lib/ai-platforms.ts",
    "apps/web/src/components/ai",
    "apps/web/src/app/ai",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260703160000_ai_platform_training",
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


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 900) -> tuple[int, str, str]:
    print(f"\n$ {command}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Created tarball with {len(pairs)} files: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-ai-platform.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    commands = f"""
set -e
cd {PROJECT_DIR}
echo "==> Extracting AI platform training files..."
tar xzf deploy-ai-platform.tar.gz
rm -f deploy-ai-platform.tar.gz

echo "==> Verifying key files..."
test -f apps/api/src/ai/ai-platform.ts
test -f apps/web/src/app/ai/[platform]/page.tsx
test -f packages/database/prisma/migrations/20260703160000_ai_platform_training/migration.sql

echo "==> Running database migrations..."
pnpm prisma:migrate deploy 2>/dev/null || npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

echo "==> Migrating legacy training knowledge doc title..."
psql postgresql://postgres:postgres@localhost:5432/watsapp -c \\
  "UPDATE \\"AiKnowledgeDocument\\" SET title = '__ai_training_instructions__WHATSAPP' WHERE title = '__ai_training_instructions__';" \\
  2>/dev/null || true

echo "==> Generating Prisma client..."
pnpm prisma:generate

echo "==> Building API..."
pnpm --filter @watsapp/api build

echo "==> Building web..."
pnpm --filter @watsapp/web build

echo "==> Restarting PM2..."
pm2 restart api web worker --update-env
sleep 5
pm2 list

echo "==> Health check..."
curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health

echo "==> AI platform settings route (expect 401 without auth)..."
curl -sS -o /dev/null -w "ai-settings:%{{http_code}}\\n" "https://almutamayiziq.com/api/v1/ai/settings?platform=META"

echo DEPLOY_AI_PLATFORM_COMPLETE
"""
    code, _, _ = run_remote(client, commands, timeout=1200)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
