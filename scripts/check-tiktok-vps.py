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
SELECT t.slug, ta.status, ta."businessName", ta."advertiserId", ta."connectedAt", (tt.id IS NOT NULL) AS has_token
FROM "TikTokAccount" ta
JOIN "Team" t ON t.id = ta."teamId"
LEFT JOIN "TikTokToken" tt ON tt."accountId" = ta.id;

SELECT u.email, tla."openId", tla."displayName", tla."expiresAt"
FROM "TikTokLoginAccount" tla
JOIN "User" u ON u.id = tla."userId";

SELECT u.email, tmc."connectedAt", tmc."hasBusinessAccess", tmc."businessCenterId"
FROM "TikTokMarketingConnection" tmc
JOIN "User" u ON u.id = tmc."userId";

SELECT t.slug, tac."clientKeyHint"
FROM "TikTokAppCredentials" tac
JOIN "Team" t ON t.id = tac."teamId";
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
client.close()
