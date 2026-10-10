#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

script = r"""
set -e
cd /root/whatsapp_GitHub

# Remove partial uploads that break compilation but are not used by VPS integrations module
rm -rf apps/api/src/integrations/telegram-user

# Restore files that were overwritten by partial deploys
git checkout apps/api/src/modules/whatsapp/events.service.ts 2>/dev/null || true
git checkout apps/api/src/integrations/integrations.module.ts 2>/dev/null || true
git checkout apps/api/src/channels/outbound-channel.service.ts 2>/dev/null || true
git checkout apps/api/src/channels/outbound.module.ts 2>/dev/null || true

# Re-apply MetaPublicModule patch
python3 << 'PY'
from pathlib import Path
path = Path('/root/whatsapp_GitHub/apps/api/src/app.module.ts')
text = path.read_text(encoding='utf-8')
if 'MetaPublicModule' not in text:
    text = text.replace(
        "import { IntegrationsModule } from './integrations/integrations.module';",
        "import { IntegrationsModule } from './integrations/integrations.module';\nimport { MetaPublicModule } from './integrations/meta/meta-public.module';",
    )
    text = text.replace('    IntegrationsModule,\n', '    IntegrationsModule,\n    MetaPublicModule,\n', 1)
    path.write_text(text, encoding='utf-8')
    print('patched app.module')
else:
    print('app.module already patched')
PY

pnpm prisma:generate
pnpm --filter @watsapp/api build

pm2 restart api --update-env
sleep 6

echo -n "health:"
curl -sS -o /dev/null -w "%{http_code}\n" https://almutamayiziq.com/api/v1/health
echo -n "meta-callback:"
curl -sS -o /dev/null -w "%{http_code}\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"
"""

_, o, e = c.exec_command(script, timeout=600)
print(o.read().decode('utf-8', errors='replace'))
err = e.read().decode('utf-8', errors='replace')
if err:
    print('STDERR:', err)
c.close()
