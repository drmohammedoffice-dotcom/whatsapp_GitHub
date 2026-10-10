#!/usr/bin/env python3
"""Deploy Google Calendar production hardening to VPS."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

# Secrets come from env / deploy-time only — never commit into source.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI",
    "https://www.chatloora.com/api/v1/integrations/google/callback",
)

UPLOAD = [
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260717190000_google_calendar_sync_hardening/migration.sql",
    "apps/api/src/integrations/google-calendar/google-calendar-api.client.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-oauth.service.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-token.service.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-sync.service.ts",
    "apps/api/src/integrations/google-calendar/google-calendar.controllers.ts",
    "apps/api/src/appointments/appointments.module.ts",
    "apps/api/src/appointments/google-calendar.controller.ts",
    "apps/api/src/appointments/appointments.service.ts",
    "apps/api/src/appointments/appointment-reminder.service.ts",
    "apps/api/src/appointments/appointment-reminder.processor.ts",
    "apps/api/src/appointments/appointment-profile.service.ts",
    "apps/api/src/appointments/dto/appointment.dto.ts",
    "apps/web/src/app/settings/google-calendar/page.tsx",
    "apps/web/src/app/appointments/settings/page.tsx",
    ".env.example",
]


def main() -> int:
    pairs = []
    for rel in UPLOAD:
        src = REPO / rel
        if not src.exists():
            raise FileNotFoundError(src)
        pairs.append((src, rel.replace("\\", "/")))

    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    remote_tar = f"{PROJECT}/deploy-gcal.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    # Escape secret for shell single-quotes
    secret_esc = GOOGLE_CLIENT_SECRET.replace("'", "'\\''")
    redirect_esc = GOOGLE_REDIRECT_URI.replace("'", "'\\''")
    client_id_esc = GOOGLE_CLIENT_ID.replace("'", "'\\''")

    cmd = f"""
set -e
cd {PROJECT}
tar xzf deploy-gcal.tar.gz
rm -f deploy-gcal.tar.gz
mkdir -p apps/web/src/app/settings/google-calendar
mkdir -p packages/database/prisma/migrations/20260717190000_google_calendar_sync_hardening

# Upsert Google OAuth env (never log secrets)
python3 - <<'PY'
from pathlib import Path
env_path = Path("{PROJECT}/.env")
text = env_path.read_text(encoding="utf-8", errors="replace") if env_path.exists() else ""
updates = {{
  "GOOGLE_CLIENT_ID": "{client_id_esc}",
  "GOOGLE_CLIENT_SECRET": "{secret_esc}",
  "GOOGLE_REDIRECT_URI": "{redirect_esc}",
}}
lines = text.splitlines()
keys = set()
out = []
for line in lines:
    if not line or line.startswith("#") or "=" not in line:
        out.append(line)
        continue
    k, _, _ = line.partition("=")
    if k in updates:
        out.append(f"{{k}}={{updates[k]}}")
        keys.add(k)
    else:
        out.append(line)
for k, v in updates.items():
    if k not in keys:
        out.append(f"{{k}}={{v}}")
env_path.write_text("\\n".join(out) + "\\n", encoding="utf-8")
print("ENV_GOOGLE_UPDATED")
PY

pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 4
pm2 describe api | head -15
echo DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1200)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", "replace").decode("ascii")[-6000:])
    if err.strip():
        print(err.encode("ascii", "replace").decode("ascii")[-2500:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
