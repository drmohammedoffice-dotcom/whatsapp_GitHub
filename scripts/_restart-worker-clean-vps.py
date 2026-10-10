#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)
cmd = r"""
set -e
cd /root/whatsapp_GitHub
# Ensure PM2 runs from project root with .env
pm2 delete worker || true
pm2 start pnpm --name worker --cwd /root/whatsapp_GitHub --filter @watsapp/worker -- start
sleep 8
pm2 describe worker | head -n 40
echo '--- recent err ---'
tail -n 40 /root/.pm2/logs/worker-error.log
echo '--- recent out ---'
tail -n 40 /root/.pm2/logs/worker-out.log
"""
_, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
c.close()
