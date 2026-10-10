#!/usr/bin/env python3
"""Deploy WhatsApp session stability fix + restart API."""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

FILES = [
    "apps/api/src/modules/whatsapp/interfaces/session.interface.ts",
    "apps/api/src/modules/whatsapp/utils/disconnect.util.ts",
    "apps/api/src/modules/whatsapp/session.manager.ts",
    "apps/api/src/modules/whatsapp/events.service.ts",
    "apps/api/src/modules/whatsapp/whatsapp.repository.ts",
    "apps/api/src/modules/whatsapp/whatsapp.service.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    "apps/api/dist/apps/api/src/modules/whatsapp/interfaces/session.interface.js",
    "apps/api/dist/apps/api/src/modules/whatsapp/utils/disconnect.util.js",
    "apps/api/dist/apps/api/src/modules/whatsapp/session.manager.js",
    "apps/api/dist/apps/api/src/modules/whatsapp/events.service.js",
    "apps/api/dist/apps/api/src/modules/whatsapp/whatsapp.repository.js",
    "apps/api/dist/apps/api/src/modules/whatsapp/whatsapp.service.js",
    "apps/api/dist/apps/api/src/ai/ai-orchestrator.service.js",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    for rel in FILES:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print(" ", rel)
        sftp.put(str(local), remote)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -c "UPDATE \\"WhatsAppSession\\" SET status='DISCONNECTED', \\"failureReason\\"='Orphan session stopped' WHERE status IN ('CONNECTING','DISCONNECTED') AND id NOT IN (SELECT \\"whatsAppSessionId\\" FROM \\"Channel\\" WHERE \\"whatsAppSessionId\\" IS NOT NULL);"
PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -c "UPDATE \\"Channel\\" SET status='DISCONNECTED' WHERE provider='WHATSAPP_BAILEYS' AND status='CONNECTING';"
pm2 restart api --update-env
sleep 12
pm2 logs api --lines 15 --nostream 2>&1 | grep -iE 'Restoring|opened connection|conflict|ERROR' | tail -10
curl -sS -o /dev/null -w 'health: %{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo WA_AI_FIX_OK
"""
    _, o, e = c.exec_command(cmd, timeout=300000)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:])
    c.close()

if __name__ == "__main__":
    main()
