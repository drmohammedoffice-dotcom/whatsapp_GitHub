#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PIXEL = "D9ALMSRC77U6HL2U7LGG"

cmd = f"""
cd /root/whatsapp_GitHub
echo "=== recent Contact track lines ==="
pm2 logs api --lines 3000 --nostream 2>&1 | grep -E 'event=Contact|POST /event/track/.*{PIXEL}|registerPixelEvents|pixel/event' | tail -50
echo "=== pixel match in sent ==="
pm2 logs api --lines 4000 --nostream 2>&1 | grep -F '{PIXEL}' | grep -E 'Contact|event/track|outcome.:.sent' | tail -30
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=60)
_, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-1500:])
client.close()
