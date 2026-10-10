#!/usr/bin/env python3
"""Verify conversion indexes and recent Contact outcomes after unique drop."""
from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

REMOTE_JS = r"""
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const indexes = await p.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'tiktok_integration_conversions'
    ORDER BY indexname
  `);
  console.log('INDEXES', JSON.stringify(indexes, null, 2));

  const recent = await p.tikTokIntegrationConversion.findMany({
    where: { eventName: 'Contact' },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      createdAt: true,
      contactSent: true,
      tiktokStatus: true,
      ttclid: true,
      messageId: true,
      conversationId: true,
      whatsappPhone: true,
      tiktokError: true,
    },
  });
  console.log('RECENT', JSON.stringify(recent, null, 2));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
"""


def connect_with_retry(retries: int = 5) -> paramiko.SSHClient:
    last: Exception | None = None
    for i in range(retries):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(HOST, username="root", password=PASSWORD, timeout=90)
            return client
        except Exception as err:  # noqa: BLE001
            last = err
            print(f"connect retry {i + 1}/{retries}: {err}")
            time.sleep(3 + i * 2)
    raise RuntimeError(f"SSH connect failed: {last}")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = connect_with_retry()
    sftp = client.open_sftp()
    path = f"{PROJECT}/packages/database/tmp-verify-indexes.js"
    with sftp.file(path, "w") as f:
        f.write(REMOTE_JS)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
cd packages/database
node tmp-verify-indexes.js
rm -f tmp-verify-indexes.js
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=120000)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-2000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
