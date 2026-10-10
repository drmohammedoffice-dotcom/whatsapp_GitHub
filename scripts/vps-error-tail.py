#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
_, o, e = c.exec_command('grep -A2 "Nest can.t resolve" /root/.pm2/logs/api-error.log | tail -20; tail -5 /root/.pm2/logs/api-error.log', timeout=30)
print(o.read().decode('utf-8', errors='replace'))
c.close()
