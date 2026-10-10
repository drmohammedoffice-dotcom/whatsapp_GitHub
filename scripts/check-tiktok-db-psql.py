#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

queries = [
    "SELECT id, whatsapp_number, pixel_code, default_optimization_event, wizard_completed FROM tiktok_integrations ORDER BY updated_at DESC LIMIT 5;",
    "SELECT id, integration_id, conversation_id, contact_id, customer_phone, converted_at, conversion_event_id FROM tiktok_integration_leads ORDER BY created_at DESC LIMIT 5;",
    "SELECT id, integration_id, conversation_id, whatsapp_phone, event_id, event_name, sent_at FROM tiktok_integration_conversions ORDER BY sent_at DESC LIMIT 5;",
    "SELECT c.id, c.team_id, ws.phone_number, ws.status FROM channels c LEFT JOIN \"WhatsAppSession\" ws ON c.\"whatsAppSessionId\" = ws.id WHERE c.provider='WHATSAPP' LIMIT 5;",
    "SELECT user_id, marketing_expires_at, connected_at FROM tiktok_marketing_connections LIMIT 3;",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

for q in queries:
    cmd = f'cd /root/whatsapp_GitHub && export $(grep -v "^#" .env | xargs) && psql "$DATABASE_URL" -c "{q}"'
    print("\n===", q[:80], "===")
    _, stdout, stderr = client.exec_command(cmd, timeout=60000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err[-500:])

client.close()
