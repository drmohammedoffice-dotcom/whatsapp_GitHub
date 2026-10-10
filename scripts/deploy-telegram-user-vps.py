#!/usr/bin/env python3
"""Deploy Telegram User (MTProto) module to VPS."""
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
    "apps/api/src/integrations/telegram-user",
    "apps/api/src/integrations/integrations.module.ts",
    "apps/api/src/integrations/integrations-hub.service.ts",
    "apps/api/src/config/env.ts",
    "apps/api/package.json",
    "apps/web/src/components/integrations/telegram-user-connect.tsx",
    "apps/web/src/components/integrations/hub/integration-hub-card.tsx",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/types.ts",
    "apps/web/src/lib/telegram-phone.ts",
    "apps/web/src/app/settings/integrations/page.tsx",
    ".env.example",
]


def collect_files() -> list[tuple[Path, str]]:
    pairs: list[tuple[Path, str]] = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(f"Missing: {src}")
        if src.is_dir():
            for path in src.rglob("*"):
                if path.is_file():
                    pairs.append((path, str(path.relative_to(REPO_ROOT)).replace("\\", "/")))
        else:
            pairs.append((src, rel.replace("\\", "/")))
    return pairs


def main() -> int:
    pairs = collect_files()
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    sftp.put(tar_path, f"{PROJECT_DIR}/deploy-telegram-user.tar.gz")
    sftp.close()
    os.remove(tar_path)

    script = f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-telegram-user.tar.gz
rm -f deploy-telegram-user.tar.gz

# Ensure TELEGRAM MTProto env keys exist (values must be set from my.telegram.org)
if ! grep -q '^TELEGRAM_API_ID=' .env 2>/dev/null; then
  echo '' >> .env
  echo '# Telegram personal account (MTProto) — https://my.telegram.org/apps' >> .env
  echo 'TELEGRAM_API_ID=' >> .env
  echo 'TELEGRAM_API_HASH=' >> .env
fi

pnpm install --filter @watsapp/api...
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 4
curl -sS -o /dev/null -w 'send-code:%{{http_code}}\\n' -X POST http://127.0.0.1:4000/api/v1/telegram-user/auth/send-code -H 'Content-Type: application/json' -d '{{"phoneNumber":"+9647864314333"}}'
echo DEPLOY_TELEGRAM_USER_COMPLETE
"""
    print(f"Deploying {len(pairs)} files...")
    _, stdout, stderr = client.exec_command(script, timeout=900)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    safe = out.encode("ascii", errors="replace").decode("ascii")
    print(safe)
    if err.strip():
        print(err.encode("ascii", errors="replace").decode("ascii"), file=sys.stderr)
    client.close()
    return stdout.channel.recv_exit_status()


if __name__ == "__main__":
    raise SystemExit(main())
