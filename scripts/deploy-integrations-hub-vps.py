#!/usr/bin/env python3
"""Deploy Integrations Hub (API + web UI) to production VPS."""
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
    "apps/api/src/integrations/integrations-hub.types.ts",
    "apps/api/src/integrations/integrations-hub.service.ts",
    "apps/api/src/integrations/integrations-hub.controller.ts",
    "apps/api/src/integrations/connections.controller.ts",
    "apps/api/src/integrations/connections.service.ts",
    "apps/api/src/integrations/meta/meta-api.client.ts",
    "apps/api/src/integrations/meta/meta-public.controller.ts",
    "apps/api/src/integrations/meta/meta-oauth.service.ts",
    "apps/api/src/conversations/conversations.service.ts",
    "apps/api/src/conversations/dto/conversation.dto.ts",
    "apps/web/src/app/settings/integrations/page.tsx",
    "apps/web/src/app/inbox/social/page.tsx",
    "apps/web/src/components/inbox/inbox-view.tsx",
    "apps/web/src/lib/channels.ts",
    "apps/web/src/components/integrations/meta-oauth-connect.tsx",
    "apps/web/src/app/settings/page.tsx",
    "apps/web/src/app/integrations/page.tsx",
    "apps/web/src/app/integrations/meta/select/page.tsx",
    "apps/web/src/components/integrations/hub",
    "apps/web/src/components/layout/nav-config.ts",
    "apps/web/src/lib/integrations-hub.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]


def make_tarball() -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in UPLOAD_PATHS:
            src = REPO_ROOT / rel
            if not src.exists():
                raise FileNotFoundError(f"Missing: {src}")
            if src.is_dir():
                for path in src.rglob("*"):
                    if path.is_file():
                        arc = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
                        tar.add(path, arcname=arc)
            else:
                tar.add(src, arcname=rel.replace("\\", "/"))
    return tar_path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tar_path = make_tarball()
    print(f"Tarball: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-hub.tar.gz")

    vps_module = b"""import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { SecurityModule } from '../security/security.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { IntegrationsHubController } from './integrations-hub.controller';
import { IntegrationsHubService } from './integrations-hub.service';
import { MetaApiClient } from './meta/meta-api.client';
import { MetaController, MetaOAuthCallbackController, MetaWebhookController } from './meta/meta.controller';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaService } from './meta/meta.service';
import { MetaWebhookLogService } from './meta/meta-webhook-log.service';
import { TelegramController, TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramService } from './telegram/telegram.service';
import { TikTokLoginKitModule } from './tiktok-login-kit/tiktok-login-kit.module';

@Module({
  imports: [ChannelsModule, AuthModule, AuditModule, SecurityModule, WhatsAppModule, TikTokLoginKitModule],
  controllers: [
    MetaController,
    MetaOAuthCallbackController,
    MetaWebhookController,
    TelegramController,
    TelegramWebhookController,
    ConnectionsController,
    IntegrationsHubController,
  ],
  providers: [MetaService, MetaOAuthService, MetaWebhookLogService, MetaApiClient, TelegramService, ConnectionsService, IntegrationsHubService],
  exports: [MetaService, TelegramService, ConnectionsService, IntegrationsHubService],
})
export class IntegrationsModule {}
"""
    remote_module = vps_module.decode("utf-8")

    sftp.close()
    os.remove(tar_path)

    cmd = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-hub.tar.gz
rm -f deploy-hub.tar.gz
cat > apps/api/src/integrations/integrations.module.ts << 'VPSMOD'
{remote_module}
VPSMOD
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
curl -sS -o /dev/null -w "health:%{{http_code}}\n" https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w "hub-page:%{{http_code}}\n" https://almutamayiziq.com/settings/integrations
echo DEPLOY_HUB_COMPLETE
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=1800)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err[-2000:], file=sys.stderr)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
