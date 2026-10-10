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
# Find how worker was configured
ls ecosystem* 2>/dev/null || true
pm2 prettylist 2>/dev/null | head -n 5 || true
# Start worker the same way as package scripts usually do
pm2 start "pnpm --filter @watsapp/worker start" --name worker --cwd /root/whatsapp_GitHub
sleep 8
pm2 list
echo '--- ERR ---'
tail -n 50 /root/.pm2/logs/worker-error.log
echo '--- OUT ---'
tail -n 30 /root/.pm2/logs/worker-out.log
"""
_, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
c.close()
