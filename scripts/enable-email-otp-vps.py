#!/usr/bin/env python3
"""Enable email OTP verification with custom Resend sender."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
BASE = "https://almutamayiziq.com"
FROM_EMAIL = "ChatLoora <chatloora.com@gmail.com>"


def post(path: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)

    cmd = f"""
set -e
cd {PROJECT}
if grep -q '^RESEND_FROM_EMAIL=' .env; then
  sed -i 's|^RESEND_FROM_EMAIL=.*|RESEND_FROM_EMAIL={FROM_EMAIL}|' .env
else
  echo 'RESEND_FROM_EMAIL={FROM_EMAIL}' >> .env
fi
if grep -q '^AUTH_OTP_ENABLED=' .env; then
  sed -i 's/^AUTH_OTP_ENABLED=.*/AUTH_OTP_ENABLED=true/' .env
else
  echo 'AUTH_OTP_ENABLED=true' >> .env
fi
grep -E '^RESEND_FROM_EMAIL=|^AUTH_OTP_ENABLED=' .env
pm2 restart api --update-env
sleep 12
curl -sS -w '\\nhealth:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health
echo OTP_ENABLE_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=120000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-2000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()

    if code != 0:
        return code

    print("\n=== Test login OTP (drmohammedoffice@gmail.com) ===")
    status, body = post(
        "/api/v1/auth/login",
        {"email": "drmohammedoffice@gmail.com", "password": "wrong-password-test"},
    )
    print("status:", status, "body:", json.dumps(body, ensure_ascii=False)[:500])

    if status == 401:
        print("OK: credentials check works (401 expected with wrong password)")
    elif status == 200 and body.get("requiresOtp"):
        print("OK: OTP challenge returned for valid login")
    elif status == 500:
        print("FAIL: still internal server error")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
