#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

cmds = [
    "grep -n MetaPublicModule /root/whatsapp_GitHub/apps/api/src/app.module.ts || echo NO_META_MODULE",
    "test -f /root/whatsapp_GitHub/apps/api/src/integrations/meta/meta-public.module.ts && echo MODULE_OK || echo MODULE_MISSING",
    "cd /root/whatsapp_GitHub && pnpm --filter @watsapp/api build 2>&1 | tail -30",
]
for cmd in cmds:
    print('===', cmd[:80])
    _, o, e = c.exec_command(cmd, timeout=300)
    print(o.read().decode('utf-8', errors='replace'))
    err = e.read().decode('utf-8', errors='replace')
    if err:
        print('STDERR:', err)
c.close()
