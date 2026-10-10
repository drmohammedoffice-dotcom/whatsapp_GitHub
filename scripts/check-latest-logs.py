#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
_, o, _ = c.exec_command("pm2 logs api --lines 50 --nostream 2>&1 | grep '386775\\|386751\\|Failed to send\\|Warmed Telegram\\|530864071' | tail -20", timeout=20)
print(o.read().decode('utf-8', 'replace'))
c.close()
