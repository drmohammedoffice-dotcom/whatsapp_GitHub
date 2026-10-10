#!/usr/bin/env python3
import os, sys, time, paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
time.sleep(10)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
_, o, _ = c.exec_command("pm2 logs api --lines 120 --nostream 2>&1 | grep -E 'Warmed Telegram|peer cache|Failed to send AI|Could not resolve|AI_REPLY' | tail -25", timeout=30)
print(o.read().decode('utf-8', 'replace'))
c.close()
