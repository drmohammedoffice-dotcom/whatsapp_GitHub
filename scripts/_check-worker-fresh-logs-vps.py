#!/usr/bin/env python3
import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password="", timeout=60)
time.sleep(3)
cmd = r"""
# truncate old logs for clarity
: > /root/.pm2/logs/worker-error.log
: > /root/.pm2/logs/worker-out.log
pm2 restart worker
sleep 10
pm2 jlist | python3 -c "import sys,json; 
for p in json.load(sys.stdin):
  if p['name']=='worker':
    print('status', p['pm2_env']['status'], 'restarts', p['pm2_env'].get('restart_time'), 'uptime', p['pm2_env'].get('pm_uptime'))"
echo '--- ERR ---'
cat /root/.pm2/logs/worker-error.log | tail -n 40
echo '--- OUT ---'
cat /root/.pm2/logs/worker-out.log | tail -n 40
grep -n billing /root/whatsapp_GitHub/apps/worker/dist/apps/api/src/creative-studio/creative-studio.core.module.js || echo 'dist core: no billing'
"""
_, o, e = c.exec_command(cmd, timeout=90)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-1500:])
c.close()
