#!/usr/bin/env python3
import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "pm2 list",
    "grep -c canSendOutbound /root/whatsapp_GitHub/apps/api/dist/apps/api/src/ai/ai-orchestrator.service.js || echo NOT_BUILT",
    "grep -c AI_INBOUND_TYPES /root/whatsapp_GitHub/apps/api/src/channels/channel-message.service.ts || echo MISSING",
]

for cmd in cmds:
    print(f"\n=== {cmd} ===")
    _, stdout, stderr = client.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err)

client.close()
