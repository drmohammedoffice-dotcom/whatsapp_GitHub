#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = r"""
pm2 logs api --lines 1500 --nostream 2>&1 | grep -E 'POST /event/track/|outcome.:.sent|event=Contact|event=PageView|event=ViewContent' | tail -40
echo "--- counts ---"
pm2 logs api --lines 2500 --nostream 2>&1 | grep -c 'event=Contact' || true
pm2 logs api --lines 2500 --nostream 2>&1 | grep -c 'event=PageView' || true
pm2 logs api --lines 2500 --nostream 2>&1 | grep -c 'event=ViewContent' || true
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
