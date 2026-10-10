#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
_, o, e = c.exec_command('pm2 logs api --lines 40 --nostream 2>&1', timeout=60)
print(o.read().decode('utf-8', errors='replace'))
c.close()
