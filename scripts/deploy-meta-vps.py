#!/usr/bin/env python3
"""Deploy Meta public webhook + OAuth routes to production VPS."""
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
    "apps/api/src/integrations/meta",
    "apps/api/src/main.ts",
    "apps/api/src/config/env.ts",
    "apps/api/src/channels/channel-token.service.ts",
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/channels/channels.module.ts",
    "apps/api/src/storage",
    "apps/web/src/components/inbox/inbox-view.tsx",
    "apps/web/src/components/inbox/message-media.tsx",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations/20260703120000_meta_oauth_tokens",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing deploy path: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file() and "node_modules" not in path.parts:
                    arc = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
                    pairs.append((path, arc))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def make_tarball(pairs: list[tuple[Path, str]]) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)
    return tar_path


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {command}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pairs = collect_files()
    tar_path = make_tarball(pairs)
    print(f"Created tarball with {len(pairs)} files: {tar_path}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30)

    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-meta.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    patch_app_module = r"""
python3 << 'PY'
from pathlib import Path
path = Path('/root/whatsapp_GitHub/apps/api/src/app.module.ts')
text = path.read_text(encoding='utf-8')
if 'MetaPublicModule' not in text:
    text = text.replace(
        "import { IntegrationsModule } from './integrations/integrations.module';",
        "import { IntegrationsModule } from './integrations/integrations.module';\nimport { MetaPublicModule } from './integrations/meta/meta-public.module';",
    )
    text = text.replace(
        '    IntegrationsModule,\n',
        '    IntegrationsModule,\n    MetaPublicModule,\n',
        1,
    )
    path.write_text(text, encoding='utf-8')
    print('Patched app.module.ts with MetaPublicModule')
else:
    print('MetaPublicModule already in app.module.ts')
PY
"""

    patch_integrations_module = r"""
python3 << 'PY'
from pathlib import Path
content = '''import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { SecurityModule } from '../security/security.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { IntegrationsHubController } from './integrations-hub.controller';
import { IntegrationsHubService } from './integrations-hub.service';
import { MetaApiClient } from './meta/meta-api.client';
import { MetaController, MetaOAuthCallbackController, MetaWebhookController } from './meta/meta.controller';
import { MetaMediaService } from './meta/meta-media.service';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaService } from './meta/meta.service';
import { MetaWebhookLogService } from './meta/meta-webhook-log.service';
import { TelegramController, TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramService } from './telegram/telegram.service';
import { TikTokLoginKitModule } from './tiktok-login-kit/tiktok-login-kit.module';

@Module({
  imports: [ChannelsModule, AuthModule, AuditModule, SecurityModule, StorageModule, WhatsAppModule, TikTokLoginKitModule],
  controllers: [
    MetaController,
    MetaOAuthCallbackController,
    MetaWebhookController,
    TelegramController,
    TelegramWebhookController,
    ConnectionsController,
    IntegrationsHubController,
  ],
  providers: [MetaService, MetaOAuthService, MetaWebhookLogService, MetaMediaService, MetaApiClient, TelegramService, ConnectionsService, IntegrationsHubService],
  exports: [MetaService, TelegramService, ConnectionsService, IntegrationsHubService],
})
export class IntegrationsModule {}
'''
Path('/root/whatsapp_GitHub/apps/api/src/integrations/integrations.module.ts').write_text(content, encoding='utf-8')
print('Patched integrations.module.ts with Meta OAuth + Integrations Hub')
PY
"""

    commands = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-meta.tar.gz
rm -f deploy-meta.tar.gz

{patch_app_module}

{patch_integrations_module}

grep -n "api/auth/meta/callback" apps/api/src/main.ts | head -1
test -f apps/api/src/integrations/meta/meta-public.module.ts

pnpm prisma:migrate deploy 2>/dev/null || npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
pnpm prisma:generate
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 5

curl -sS -o /dev/null -w "health:%{{http_code}}\\n" https://almutamayiziq.com/api/v1/health
curl -sS -o /dev/null -w "meta-callback:%{{http_code}}\\n" "https://almutamayiziq.com/api/auth/meta/callback?code=test&state=test"
echo DEPLOY_META_COMPLETE
"""
    code, _, _ = run_remote(client, commands, timeout=900)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
