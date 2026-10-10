#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=60)
cmds = [
    'ls -la /root/whatsapp_GitHub/apps/web/public/',
    'curl -sS -o /dev/null -w "logo:%{http_code}\\n" https://almutamayiziq.com/chatloora-logo.png',
    'curl -sS -o /dev/null -w "icon:%{http_code}\\n" https://almutamayiziq.com/chatloora-icon.png',
    'curl -sS -o /dev/null -w "home:%{http_code}\\n" https://almutamayiziq.com/',
    'head -20 /root/whatsapp_GitHub/apps/web/src/app/page.tsx',
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=60000)
    print('>>>', cmd)
    print(o.read().decode('utf-8', 'replace'))
    err = e.read().decode('utf-8', 'replace')
    if err.strip():
        print('ERR:', err[:400])
c.close()
