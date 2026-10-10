#!/usr/bin/env python3
import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)
time.sleep(4)
cmd = r"""
cd /root/whatsapp_GitHub/apps/worker
echo '--- run worker once ---'
node dist/apps/worker/src/main.js > /tmp/worker-once.out 2>/tmp/worker-once.err &
WPID=$!
sleep 8
kill $WPID 2>/dev/null || true
echo 'OUT:'; tail -n 40 /tmp/worker-once.out
echo 'ERR:'; tail -n 60 /tmp/worker-once.err
"""
_, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
c.close()
