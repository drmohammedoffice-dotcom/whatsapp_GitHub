#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
P = '/root/whatsapp_GitHub'
cmds = [
    f'ls {P}/apps/web/src/components/inbox/message-media.tsx',
    f'ls {P}/apps/web/src/components/ui/scroll-area.tsx',
    f'ls {P}/apps/web/src/components/ui/tabs.tsx',
    f'ls {P}/apps/web/src/lib/socket.ts',
    f'ls {P}/apps/web/src/components/shared/empty-state.tsx',
    f'grep -c "provider" {P}/apps/api/src/conversations/dto/conversation.dto.ts',
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=15)
    out = o.read().decode().rstrip()
    err = e.read().decode().rstrip()
    print(f'{cmd} -> {out or err}')
c.close()
