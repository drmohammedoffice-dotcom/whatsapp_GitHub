#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
_, o, _ = c.exec_command(
    'curl -sS -o /dev/null -w "social-inbox:%{http_code}\\n" https://almutamayiziq.com/inbox/social; '
    'curl -sS -o /dev/null -w "messenger-inbox:%{http_code}\\n" https://almutamayiziq.com/inbox/messenger',
    timeout=30,
)
print(o.read().decode())
c.close()
