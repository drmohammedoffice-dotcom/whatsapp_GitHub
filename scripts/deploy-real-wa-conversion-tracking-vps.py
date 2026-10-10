#!/usr/bin/env python3
"""Deploy Real WhatsApp Conversion Tracking (TikTok Events API) to production VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    # Schema + migration
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260715180000_tiktok_events_api_credentials",
    # API TikTok conversion tracking
    "apps/api/src/tiktok-integration",
    "apps/api/src/auth/auth.module.ts",
    "apps/api/src/auth/auth.service.ts",
    "apps/api/src/billing",
    "apps/api/src/config/env.ts",
    "apps/api/src/app.module.ts",
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/channels/channels.module.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    # Web dashboard / credentials / activate safety
    "apps/web/src/app/tiktok/integration",
    "apps/web/src/app/tiktok/activate",
    "apps/web/src/components/tiktok",
    "apps/web/src/components/inbox/inbox-view.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/tiktok-pixel-script.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
    ".env.example",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if not path.is_file():
                    continue
                if "node_modules" in path.parts:
                    continue
                # Skip local test harness on VPS (optional but keeps deploy lean)
                if "__tests__" in path.parts:
                    continue
                arc = str(path.relative_to(REPO)).replace("\\", "/")
                pairs.append((path, arc))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def ensure_remote_dir(sftp: paramiko.SFTPClient, client: paramiko.SSHClient, remote_dir: str) -> None:
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        print("mkdir", remote_dir)
        _, stdout, _ = client.exec_command(f"mkdir -p {remote_dir}")
        stdout.channel.recv_exit_status()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    print(f"Uploading {len(pairs)} files...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)
    sftp = client.open_sftp()

    for local, arc in pairs:
        remote = f"{PROJECT}/{arc}"
        ensure_remote_dir(sftp, client, remote.rsplit("/", 1)[0])
        print("Upload", arc)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
echo '=== migrate ==='
pnpm --filter @watsapp/database exec prisma migrate deploy
echo '=== generate ==='
pnpm --filter @watsapp/database exec prisma generate
echo '=== build api ==='
pnpm --filter @watsapp/api build
echo '=== build web ==='
pnpm --filter @watsapp/web build
echo '=== restart ==='
pm2 restart api web --update-env
# worker processes TikTok contact queue if present
pm2 restart worker --update-env 2>/dev/null || true
sleep 12
echo '=== health ==='
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/health || true
curl -sS -o /dev/null -w 'web:%{{http_code}}\\n' https://almutamayiziq.com/tiktok/integration || true
echo REAL_WA_CONVERSION_TRACKING_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-6000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
