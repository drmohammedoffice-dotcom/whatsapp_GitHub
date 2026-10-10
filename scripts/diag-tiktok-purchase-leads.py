#!/usr/bin/env python3
"""Diagnose TikTok Purchase pixel + 0 leads."""
import os
import sys
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

SQL = r"""
\pset format aligned
\pset border 2

SELECT i.id, i.redirect_slug, i.pixel_code, i.whatsapp_number,
       i.default_optimization_event, i.custom_event_name, i.pixel_status,
       i.wizard_completed, i.billing_suspended, u.email,
       (SELECT count(*) FROM tiktok_integration_clicks c WHERE c.integration_id = i.id) AS clicks,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id = i.id AND l.customer_phone IS NOT NULL) AS linked_leads,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id = i.id) AS total_leads
FROM tiktok_integrations i
JOIN users u ON u.id = i.user_id
WHERE i.wizard_completed = true
ORDER BY i.updated_at DESC
LIMIT 10;

SELECT l.id AS lead_id, l.created_at, l.customer_phone, l.conversation_id,
       i.redirect_slug, i.whatsapp_number, i.default_optimization_event
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
ORDER BY l.created_at DESC
LIMIT 15;

SELECT c.id, c.status, c."externalId", ws.phone_number, c."teamId"
FROM "Channel" c
LEFT JOIN "WhatsAppSession" ws ON ws."channelId" = c.id
WHERE c.provider = 'WHATSAPP_BAILEYS'
ORDER BY c."updatedAt" DESC
LIMIT 10;

SELECT m.id, left(m.text, 80) AS text_preview, m.direction, m."createdAt",
       conv.id AS conv_id, ch."externalId" AS channel_phone
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "Channel" ch ON ch.id = conv."channelId"
WHERE m."createdAt" > NOW() - INTERVAL '6 hours'
  AND m.direction = 'INBOUND'
ORDER BY m."createdAt" DESC
LIMIT 20;

SELECT id, integration_id, conversation_id, whatsapp_phone, event_name, sent_at
FROM tiktok_integration_conversions
ORDER BY sent_at DESC
LIMIT 10;
"""

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = c.open_sftp()
    with sftp.file("/tmp/diag_purchase.sql", "w") as f:
        f.write(SQL)
    sftp.close()
    _, o, e = c.exec_command(
        "PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/diag_purchase.sql",
        timeout=120000,
    )
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err, file=sys.stderr)
    _, o2, _ = c.exec_command(
        "pm2 logs api --lines 80 --nostream 2>/dev/null | grep -i TikTokConversion | tail -30",
        timeout=60000,
    )
    print("\n--- Recent TikTokConversion logs ---")
    print(o2.read().decode("utf-8", "replace"))
    c.close()

if __name__ == "__main__":
    main()
