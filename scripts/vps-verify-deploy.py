#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmds = [
    "pm2 status api web | head -15",
    "sleep 3; curl -s -o /dev/null -w 'api_track: %{http_code}\\n' 'http://127.0.0.1:4000/api/tiktok-integration/public/track/5tx7lb9w'",
    "curl -s -o /dev/null -w 'web_r: %{http_code}\\n' 'https://almutamayiziq.com/r/5tx7lb9w'",
    "pm2 logs api --lines 5 --nostream 2>&1 | tail -8",
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=60000)
    print('$', cmd[:70])
    print(o.read().decode('utf-8', errors='replace'))
c.close()
