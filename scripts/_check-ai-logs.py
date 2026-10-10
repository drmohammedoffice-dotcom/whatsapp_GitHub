#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmd = r"""cd /root/whatsapp_GitHub
echo '===== pm2 status ====='
pm2 list
echo '===== last 120 api log lines (AI related) ====='
pm2 logs api --lines 400 --nostream 2>/dev/null | grep -E '\[AI|Gateway|ai-inbound|Enqueued|Using API|Rate Limited|Success|Provider failed|Job (started|completed|failed)' | tail -n 80
echo '===== last errors ====='
tail -n 60 /root/.pm2/logs/api-error.log
"""
_, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-2000:])
c.close()
