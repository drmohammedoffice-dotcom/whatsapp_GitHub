#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

sql = r"""
SELECT i.id, i.redirect_slug, i.whatsapp_number, i.wizard_completed, i.pixel_code IS NOT NULL AS has_pixel,
       (SELECT count(*) FROM tiktok_integration_clicks c WHERE c.integration_id = i.id) AS clicks,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id = i.id) AS leads,
       (SELECT count(*) FROM tiktok_integration_conversions cv WHERE cv.integration_id = i.id) AS conversions
FROM tiktok_integrations i
ORDER BY i.updated_at DESC
LIMIT 5;

SELECT l.id, l.customer_phone, l.conversation_id, l.converted_at, l.created_at
FROM tiktok_integration_leads l
ORDER BY l.created_at DESC
LIMIT 10;

SELECT cv.id, cv.whatsapp_phone, cv.event_name, cv.sent_at, cv.conversation_id
FROM tiktok_integration_conversions cv
ORDER BY cv.sent_at DESC
LIMIT 10;

SELECT c.id, c.team_id, c.provider, c.external_id, ws.phone_number AS session_phone
FROM channels c
LEFT JOIN whats_app_sessions ws ON ws.channel_id = c.id
WHERE c.provider = 'WHATSAPP_BAILEYS'
ORDER BY c.updated_at DESC
LIMIT 5;
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
cmd = f"cat > /tmp/tiktok_diag.sql << 'EOF'\n{sql}\nEOF\nPGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/tiktok_diag.sql 2>&1"
_, o, e = c.exec_command(cmd, timeout=60000)
out = o.read().decode("utf-8", "replace")
print(out.encode("ascii", "replace").decode("ascii"))

_, o2, _ = c.exec_command("pm2 logs api --lines 80 --nostream 2>&1 | grep -i TikTokConversion | tail -20", timeout=60000)
logs = o2.read().decode("utf-8", "replace")
print("=== TikTokConversion logs ===")
print(logs.encode("ascii", "replace").decode("ascii"))
c.close()
