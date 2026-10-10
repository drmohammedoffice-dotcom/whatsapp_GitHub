#!/usr/bin/env python3
"""Deploy Clinic AI & Calendar Center (timezone sync, knowledge, voice library, UI)."""
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

UPLOAD = [
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260718010000_clinic_center_timezone_knowledge/migration.sql",
    "packages/database/prisma/migrations/20260718230000_ai_voice_library_metadata/migration.sql",
    "apps/api/src/appointments/appointment-timezone.util.ts",
    "apps/api/src/appointments/appointment-slots.util.ts",
    "apps/api/src/appointments/appointment-slots.util.spec.ts",
    "apps/api/src/appointments/appointment-profile.service.ts",
    "apps/api/src/appointments/appointments.service.ts",
    "apps/api/src/appointments/appointments.controller.ts",
    "apps/api/src/appointments/dto/appointment.dto.ts",
    "apps/api/src/integrations/google-calendar/calendar.service.ts",
    "apps/api/src/integrations/google-calendar/calendar.service.spec.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-api.client.ts",
    "apps/api/src/integrations/google-calendar/google-calendar-oauth.service.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    "apps/api/src/ai/ai-knowledge.service.ts",
    "apps/api/src/ai/ai-training-media.service.ts",
    "apps/api/src/ai/ai-document-extractor.service.ts",
    "apps/api/src/ai/ai.controller.ts",
    "apps/api/src/storage/local-storage.service.ts",
    "apps/web/src/components/appointments/clinic-calendar-center.tsx",
    "apps/web/src/app/settings/google-calendar/page.tsx",
    "apps/web/src/app/appointments/page.tsx",
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
    remote_tar = f"{PROJECT}/deploy-clinic-center.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT}
tar xzf deploy-clinic-center.tar.gz
rm -f deploy-clinic-center.tar.gz
mkdir -p apps/web/src/components/appointments
mkdir -p apps/web/src/app/settings/google-calendar
mkdir -p packages/database/prisma/migrations/20260718010000_clinic_center_timezone_knowledge
mkdir -p packages/database/prisma/migrations/20260718230000_ai_voice_library_metadata

pnpm --filter @watsapp/database exec prisma migrate deploy
pnpm --filter @watsapp/database exec prisma generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api worker web --update-env
sleep 5
pm2 describe api | head -12
curl -sS -o /dev/null -w "WEB_HTTP=%{{http_code}}\\n" https://almutamayiziq.com/settings/google-calendar || true
curl -sS -o /dev/null -w "API_HTTP=%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health || true
echo DEPLOY_CLINIC_CENTER_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1500)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", "replace").decode("ascii")[-8000:])
    if err.strip():
        print(err.encode("ascii", "replace").decode("ascii")[-3000:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
