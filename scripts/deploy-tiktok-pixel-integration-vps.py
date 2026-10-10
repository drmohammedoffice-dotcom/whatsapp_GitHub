#!/usr/bin/env python3
"""Deploy TikTok Pixel + WhatsApp Redirect integration to production VPS."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "packages/database/prisma/schema.prisma",
    "scripts/merge-vps-platform-schema.py",
    "apps/api/src/tiktok-integration",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-business.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts",
    "apps/api/src/integrations/tiktok-login-kit/tiktok-login-kit.module.ts",
    "apps/web/src/app/tiktok/integration",
    "apps/web/src/app/r",
    "apps/web/src/app/tiktok/page.tsx",
    "apps/web/src/app/messenger/page.tsx",
    "apps/web/src/app/telegram/page.tsx",
    "apps/web/src/components/channels/channel-connect-page.tsx",
    "apps/web/src/components/tiktok/tiktok-integration-shell.tsx",
    "apps/web/src/lib/tiktok-integration.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

PATCH_SH = r'''#!/bin/bash
set -e
cd /root/whatsapp_GitHub

if ! grep -q 'TikTokIntegrationModule' apps/api/src/app.module.ts; then
  sed -i "/import { TikTokModule } from '.\/tiktok\/tiktok.module';/a import { TikTokIntegrationModule } from './tiktok-integration/tiktok-integration.module';" apps/api/src/app.module.ts
  sed -i '/TikTokModule,/a\    TikTokIntegrationModule,' apps/api/src/app.module.ts
  echo 'Patched app.module.ts'
fi

if ! grep -q "path: 'r/(.*)'" apps/api/src/main.ts; then
  python3 << 'PY'
from pathlib import Path
p = Path('apps/api/src/main.ts')
s = p.read_text()
needle = "{ path: 'api/auth/meta/callback', method: RequestMethod.GET },"
insert = """{ path: 'api/auth/meta/callback', method: RequestMethod.GET },
      { path: 'r/(.*)', method: RequestMethod.GET },
      { path: 'api/tiktok-integration/wizard', method: RequestMethod.GET },
      { path: 'api/tiktok-integration/oauth/start', method: RequestMethod.POST },
      { path: 'api/tiktok-integration/wizard/advertiser', method: RequestMethod.POST },
      { path: 'api/tiktok-integration/wizard/whatsapp', method: RequestMethod.POST },
      { path: 'api/tiktok-integration/wizard/pixel', method: RequestMethod.POST },
      { path: 'api/tiktok-integration/wizard/optimization-event', method: RequestMethod.POST },
      { path: 'api/tiktok-integration/dashboard', method: RequestMethod.GET },"""
if needle in s and "r/(.*)" not in s:
    s = s.replace(needle, insert)
    p.write_text(s)
    print('Patched main.ts')
PY
fi
'''


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file():
                    pairs.append((path, str(path.relative_to(REPO_ROOT)).replace("\\", "/")))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
        # embed patch script
        import io
        data = PATCH_SH.encode('utf-8')
        info = tarfile.TarInfo(name='patch-tiktok-pixel.sh')
        info.size = len(data)
        tar.addfile(info, io.BytesIO(data))
    print(f"Created tarball with {len(pairs)} files + patch script")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-tiktok-pixel.tar.gz")
    sftp.close()
    os.remove(tar_path)

    commands = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-tiktok-pixel.tar.gz
rm -f deploy-tiktok-pixel.tar.gz
chmod +x patch-tiktok-pixel.sh
bash patch-tiktok-pixel.sh
rm -f patch-tiktok-pixel.sh

rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-message-event.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-crm-event.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-ctx-event.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-api-log.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-event-set.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-event-set.types.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-messaging.controller.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-business-public-endpoints.controller.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-business-routing.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-business-webhook.service.ts
rm -f apps/api/src/integrations/tiktok-login-kit/tiktok-business-sync.cron.ts
rm -rf apps/api/src/tiktok-crm 2>/dev/null || true

rm -rf apps/api/src/tiktok-crm 2>/dev/null || true

# Apply full local schema + VPS platform/billing models
python3 scripts/merge-vps-platform-schema.py
cd packages/database
npx prisma generate
cd {PROJECT_DIR}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health || true
curl -sS -o /dev/null -w "redirect:%{{http_code}}\\n" "https://almutamayiziq.com/r/test-slug" || true
echo DEPLOY_TIKTOK_PIXEL_COMPLETE
"""
    _, stdout, stderr = client.exec_command(commands, timeout=1800)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
