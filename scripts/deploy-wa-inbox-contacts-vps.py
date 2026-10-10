#!/usr/bin/env python3
"""Deploy WhatsApp inbox visibility + contact phone/avatar fixes."""
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
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/conversations/conversations.service.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/web/src/components/inbox/inbox-view.tsx",
]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
# Un-hide WhatsApp chats previously archived because channel purpose was tracking.
PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "Conversation" AS c
SET "isArchived" = false
FROM "Channel" AS ch
WHERE c."channelId" = ch.id
  AND ch.provider = 'WHATSAPP_BAILEYS'
  AND c."isArchived" = true
  AND ch.metadata->>'purpose' = 'tracking';
SQL
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web worker --update-env
sleep 18
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo WA_INBOX_CONTACTS_OK
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
