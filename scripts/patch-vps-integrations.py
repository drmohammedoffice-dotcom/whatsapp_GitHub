#!/usr/bin/env python3
"""Patch VPS integrations.module.ts so MetaController DI resolves."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"

INTEGRATIONS_MODULE = """import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { SecurityModule } from '../security/security.module';
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
  ],
  providers: [MetaService, MetaOAuthService, MetaWebhookLogService, MetaApiClient, TelegramService],
  exports: [MetaService, TelegramService],
})
export class IntegrationsModule {}
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    with sftp.file(f"{PROJECT_DIR}/apps/api/src/integrations/integrations.module.ts", "w") as f:
        f.write(INTEGRATIONS_MODULE)
    sftp.close()
    print("Wrote integrations.module.ts with Meta OAuth providers")

    script = f"""
set -e
cd {PROJECT_DIR}
pnpm --filter @watsapp/api build
pm2 restart api --update-env
sleep 8
curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w "meta:%{{http_code}}\\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"
"""
    _, stdout, stderr = client.exec_command(script, timeout=300)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err, file=sys.stderr)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
