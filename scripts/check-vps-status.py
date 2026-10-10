#!/usr/bin/env python3
import os, paramiko
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'tmp' / 'vps-verify.txt'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmds = [
    'pm2 describe api | grep -E "status|restarts|uptime" | head -5',
    'grep -c "tiktokBusiness:" /root/whatsapp_GitHub/apps/web/src/lib/i18n/en.ts',
    'test -f /root/whatsapp_GitHub/apps/api/src/integrations/tiktok-login-kit/tiktok-business-public.controller.ts && echo controller_ok',
    'grep "api/tiktok-business" /root/whatsapp_GitHub/apps/api/src/main.ts',
]
text = []
for cmd in cmds:
    _, o, _ = c.exec_command(cmd, timeout=30000)
    text.append(f'$ {cmd}\n{o.read().decode("utf-8", errors="replace")}')
out.write_text('\n'.join(text), encoding='utf-8')
c.close()
