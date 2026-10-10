#!/usr/bin/env python3
"""Reset Super Admin password on VPS."""
from __future__ import annotations

import json
import os
import secrets
import string
import sys

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
EMAIL = os.environ.get("ADMIN_EMAIL", "drmohammedoffice@gmail.com")
NEW_PASSWORD = os.environ.get("ADMIN_NEW_PASSWORD")


def generate_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(16))
        if (
            any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%" for c in pwd)
        ):
            return pwd


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    new_password = NEW_PASSWORD or generate_password()
    email = EMAIL.lower()

    node_script = (
        "const bcrypt = require('./apps/api/node_modules/bcryptjs');\n"
        "const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');\n"
        "const p = new PrismaClient();\n"
        "(async () => {\n"
        f"  const email = {json.dumps(email)};\n"
        f"  const newPassword = {json.dumps(new_password)};\n"
        "  const user = await p.user.findUnique({ where: { email }, include: { adminProfile: true } });\n"
        "  if (!user || !user.adminProfile || !user.adminProfile.isActive) {\n"
        "    console.log('ADMIN_RESET_FAIL:no_active_admin');\n"
        "    return;\n"
        "  }\n"
        "  const hash = await bcrypt.hash(newPassword, 12);\n"
        "  await p.user.update({ where: { id: user.id }, data: { passwordHash: hash } });\n"
        "  const ok = await bcrypt.compare(newPassword, hash);\n"
        "  console.log('ADMIN_RESET_OK:' + email + ':verify=' + ok);\n"
        "  await p.$disconnect();\n"
        "})().catch((e) => { console.error(e); process.exit(1); });\n"
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()
    with sftp.file("/root/whatsapp_GitHub/reset-admin-password.js", "w") as f:
        f.write(node_script)
    sftp.close()

    _, stdout, stderr = client.exec_command(
        "cd /root/whatsapp_GitHub && node reset-admin-password.js",
        timeout=60000,
    )
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    print(out)
    if err:
        print("STDERR:", err, file=sys.stderr)

    if "ADMIN_RESET_OK" not in out:
        client.close()
        return 1

    payload = json.dumps({"email": email, "password": new_password})
    curl = (
        "curl -sS -X POST https://almutamayiziq.com/api/v1/admin/auth/login "
        "-H 'content-type: application/json' "
        f"-d {json.dumps(payload)}"
    )
    _, stdout2, _ = client.exec_command(curl, timeout=30000)
    login_resp = stdout2.read().decode("utf-8", errors="replace")
    print("LOGIN_TEST:", "accessToken" in login_resp)
    client.exec_command("rm -f /root/whatsapp_GitHub/reset-admin-password.js", timeout=10000)
    client.close()

    print("\n--- Admin credentials ---")
    print(f"Email:    {email}")
    print(f"Password: {new_password}")
    print("URL:      https://almutamayiziq.com/admin/login")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
