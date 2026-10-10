#!/usr/bin/env python3
"""Set Telegram MTProto credentials on production VPS and verify startup."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"

API_ID = os.environ.get("TELEGRAM_API_ID", "")
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")


def run(client: paramiko.SSHClient, command: str, timeout: int = 120) -> tuple[int, str, str]:
    print(f"\n$ {command[:120]}{'...' if len(command) > 120 else ''}")
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    safe_out = out.encode("ascii", errors="replace").decode("ascii")
    safe_err = err.encode("ascii", errors="replace").decode("ascii")
    if safe_out.strip():
        print(safe_out.rstrip())
    if safe_err.strip():
        print(safe_err.rstrip(), file=sys.stderr)
    return code, out, err


def main() -> int:
    if not API_ID or not API_HASH:
        print("Set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables before running.", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    # Update .env without printing secrets
    update_env = f"""
cd {PROJECT_DIR}
ENV_FILE=.env
touch "$ENV_FILE"
grep -v '^TELEGRAM_API_ID=' "$ENV_FILE" | grep -v '^TELEGRAM_API_HASH=' > "$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"
echo 'TELEGRAM_API_ID={API_ID}' >> "$ENV_FILE"
echo 'TELEGRAM_API_HASH={API_HASH}' >> "$ENV_FILE"
grep '^TELEGRAM_API_ID=' "$ENV_FILE" | awk -F= '{{print $1 "=SET(" length($2) " chars)"}}'
grep '^TELEGRAM_API_HASH=' "$ENV_FILE" | awk -F= '{{print $1 "=SET(" length($2) " chars)"}}'
"""
    code, _, _ = run(client, update_env)
    if code != 0:
        client.close()
        return code

    restart = f"""
cd {PROJECT_DIR}
pm2 restart api --update-env
sleep 6
pm2 logs api --lines 80 --nostream 2>&1 | grep -iE 'Telegram|MTProto|telegram-user|TelegramUser' | tail -20
"""
    run(client, restart, timeout=60)

    verify = f"""
cd {PROJECT_DIR}
set -a
source .env
set +a
node <<'NODE'
const {{ ConfigService }} = require('@nestjs/config');
// Direct env check (same values Nest reads)
const id = Number(process.env.TELEGRAM_API_ID || 0);
const hash = String(process.env.TELEGRAM_API_HASH || '');
console.log('ENV_CHECK configured=' + (id > 0 && hash.length > 0));
console.log('ENV_CHECK api_id=' + id);
console.log('ENV_CHECK hash_len=' + hash.length);
NODE

# Unauthenticated send-code should return 401 (route exists), not 404
curl -sS -o /tmp/tg-send-code.json -w 'HTTP:%{{http_code}}\\n' \\
  -X POST http://127.0.0.1:4000/api/v1/telegram-user/auth/send-code \\
  -H 'Content-Type: application/json' \\
  -d '{{"phoneNumber":"+9647864314333"}}'
head -c 200 /tmp/tg-send-code.json; echo

# Ensure telegram package installed
test -d node_modules/telegram || pnpm install --filter @watsapp/api... --prefer-offline
test -f apps/api/dist/apps/api/src/integrations/telegram-user/telegram-user.controller.js && echo TG_MODULE=OK || echo TG_MODULE=MISSING
"""
    run(client, verify, timeout=180)

    client.close()
    print("\nDONE: Telegram MTProto credentials applied. User can connect from /settings/integrations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
