#!/usr/bin/env python3
"""Deploy AI voice-note training + migration (API + web)."""
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
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260714120000_ai_voice_note_training/migration.sql",
    "apps/api/src/ai/ai-training-media.service.ts",
    "apps/api/src/ai/ai.controller.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    "apps/api/src/ai/audio-ptt.util.ts",
    "apps/web/src/components/ai/voice-notes-training-panel.tsx",
    "apps/web/src/components/ai/platform-training-view.tsx",
    "apps/web/src/components/ai/training-media-panel.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    parts = remote_path.strip("/").split("/")
    cur = ""
    for part in parts[:-1]:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        if not local.exists():
            print("MISSING", rel, file=sys.stderr)
            continue
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        ensure_remote_dir(sftp, remote)
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
which ffmpeg >/dev/null 2>&1 || apt-get install -y ffmpeg
pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web worker --update-env
sleep 18
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo AI_VOICE_NOTES_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
