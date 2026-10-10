#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

_, stdout, _ = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
INSERT INTO "AiSettings" (
  id, "teamId", platform, enabled, "autoReplyEnabled", "confidenceThreshold",
  "transferOnLowConfidence", "transferOnComplaint", "transferOnRefund",
  "transferOnSensitive", "transferOnHumanRequest", "pauseAiOnHumanReply",
  "pauseAiOnAssignment", "createdAt", "updatedAt"
)
SELECT
  'test-messenger-row', "teamId", 'MESSENGER', true, true, "confidenceThreshold",
  "transferOnLowConfidence", "transferOnComplaint", "transferOnRefund",
  "transferOnSensitive", "transferOnHumanRequest", "pauseAiOnHumanReply",
  "pauseAiOnAssignment", NOW(), NOW()
FROM "AiSettings" WHERE platform = 'WHATSAPP'
ON CONFLICT DO NOTHING;

SELECT platform FROM "AiSettings" ORDER BY platform;

DELETE FROM "AiSettings" WHERE id = 'test-messenger-row';
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
client.close()
