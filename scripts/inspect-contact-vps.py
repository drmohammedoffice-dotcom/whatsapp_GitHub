#!/usr/bin/env python3
"""Inspect recent TikTok Contact conversions on VPS."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

REMOTE_JS = r"""
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.tikTokIntegrationConversion.findMany({
    where: { eventName: 'Contact' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      createdAt: true,
      sentAt: true,
      tiktokStatus: true,
      contactSent: true,
      ttclid: true,
      whatsappPhone: true,
      conversationId: true,
      messageId: true,
      tiktokError: true,
      integrationId: true,
      eventId: true,
    },
  });
  console.log('CONVERSIONS', JSON.stringify(rows, null, 2));

  const integ = await p.tikTokIntegration.findMany({
    where: { wizardCompleted: true },
    select: {
      id: true,
      pixelCode: true,
      redirectSlug: true,
      whatsappNumber: true,
      defaultOptimizationEvent: true,
      lastEventSentAt: true,
      lastEventName: true,
      lastApiError: true,
      lastApiHttpStatus: true,
      billingSuspended: true,
      teamId: true,
    },
  });
  console.log('INTEGRATIONS', JSON.stringify(integ, null, 2));

  const clicks = await p.tikTokIntegrationClick.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      createdAt: true,
      ttclid: true,
      integrationId: true,
      campaignId: true,
      adId: true,
    },
  });
  console.log('CLICKS', JSON.stringify(clicks, null, 2));

  const logs = await p.tikTokIntegrationApiLog.findMany({
    where: { eventName: 'Contact' },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      createdAt: true,
      success: true,
      httpStatus: true,
      errorMessage: true,
      eventId: true,
      requestPayload: true,
      responseBody: true,
      integrationId: true,
    },
  });
  console.log('API_LOGS', JSON.stringify(logs, null, 2));

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=90)

    sftp = client.open_sftp()
    remote_path = f"{PROJECT}/packages/database/tmp-inspect-contact.js"
    with sftp.file(remote_path, "w") as f:
        f.write(REMOTE_JS)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
echo '==== LOGS ===='
pm2 logs api --lines 2000 --nostream 2>/dev/null | grep -iE 'TikTokConversion|TikTokContact|trackPixel|no_click|message_already|Marketing API.*/event/track' | tail -n 120 || true
echo '==== DB ===='
cd {PROJECT}/packages/database
node tmp-inspect-contact.js
rm -f tmp-inspect-contact.js
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=180000)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
