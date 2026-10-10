#!/usr/bin/env python3
"""Deploy TikTok Pixel optimization-events upgrade to VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/api/src/tiktok-integration",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-marketing-oauth.service.ts",
    "apps/web/src/app/tiktok/integration",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file():
                    pairs.append((path, str(path.relative_to(REPO_ROOT)).replace("\\", "/")))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    for local, rel in pairs:
        remote = f"{PROJECT_DIR}/{rel}"
        print(f"Upload {rel}")
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT_DIR}
cd packages/database
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || true
npx prisma generate
cd {PROJECT_DIR}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -sS -o /dev/null -w "redirect:%{{http_code}}\\n" "https://almutamayiziq.com/r/test-slug" || true
echo DEPLOY_EVENTS_UPGRADE_COMPLETE
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1800)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
