#!/usr/bin/env python3
"""Deploy Meta OAuth frontend (web) + connections API to production VPS."""
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
    "apps/web/src/app/settings/page.tsx",
    "apps/web/src/app/integrations/page.tsx",
    "apps/web/src/app/integrations/meta/select/page.tsx",
    "apps/web/src/components/integrations/meta-oauth-connect.tsx",
    "apps/web/src/components/integrations/connection-card.tsx",
    "apps/web/src/components/integrations/connection-status-badge.tsx",
    "apps/web/src/components/integrations/telegram-user-connect.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

INTEGRATIONS_MODULE = """import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { SecurityModule } from '../security/security.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { MetaApiClient } from './meta/meta-api.client';
import { MetaController, MetaOAuthCallbackController, MetaWebhookController } from './meta/meta.controller';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaService } from './meta/meta.service';
import { MetaWebhookLogService } from './meta/meta-webhook-log.service';
import { TelegramController, TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramService } from './telegram/telegram.service';

@Module({
  imports: [ChannelsModule, AuthModule, AuditModule, SecurityModule],
  controllers: [
    MetaController,
    MetaOAuthCallbackController,
    MetaWebhookController,
    TelegramController,
    TelegramWebhookController,
    ConnectionsController,
  ],
  providers: [MetaService, MetaOAuthService, MetaWebhookLogService, MetaApiClient, TelegramService, ConnectionsService],
  exports: [MetaService, TelegramService, ConnectionsService],
})
export class IntegrationsModule {}
"""


def make_tarball() -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in UPLOAD_PATHS:
            src = REPO_ROOT / rel
            if not src.exists():
                raise FileNotFoundError(f"Missing deploy path: {src}")
            tar.add(src, arcname=rel.replace("\\", "/"))
    return tar_path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tar_path = make_tarball()
    print(f"Created tarball: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)

    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-web-meta.tar.gz")
    with sftp.file(f"{PROJECT_DIR}/apps/api/src/integrations/integrations.module.ts", "w") as f:
        f.write(INTEGRATIONS_MODULE)
    sftp.close()
    os.remove(tar_path)
    print("Uploaded tarball + integrations.module.ts (with ConnectionsController)")

    commands = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-web-meta.tar.gz
rm -f deploy-web-meta.tar.gz

echo "=== build api ==="
pnpm --filter @watsapp/api build

echo "=== build web ==="
pnpm --filter @watsapp/web build

pm2 restart api --update-env
pm2 restart web --update-env
sleep 10

curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w "meta-callback:%{{http_code}}\\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"
curl -sS -o /dev/null -w "web-integrations:%{{http_code}}\\n" https://almutamayiziq.com/integrations
curl -sS -o /dev/null -w "web-settings:%{{http_code}}\\n" https://almutamayiziq.com/settings
echo DEPLOY_WEB_META_COMPLETE
"""
    print("Running remote build (this can take several minutes)...")
    _, stdout, stderr = client.exec_command(commands, timeout=1800)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out)
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
