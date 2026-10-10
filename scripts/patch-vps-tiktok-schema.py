#!/usr/bin/env python3
import re
from pathlib import Path

p = Path("/root/whatsapp_GitHub/packages/database/prisma/schema.prisma")
text = p.read_text(encoding="utf-8")

if "name                     String?" not in text:
    text = text.replace(
        '  teamId                   String                  @map("team_id")\n  advertiserId',
        '  teamId                   String                  @map("team_id")\n  name                     String?\n  advertiserId',
        1,
    )

text = re.sub(r"\s*@@unique\(\[userId, teamId\]\)\n", "\n", text)

if "@@index([userId, teamId])" not in text:
    text = text.replace(
        '@@map("tiktok_integrations")',
        "  @@index([userId, teamId])\n  @@map(\"tiktok_integrations\")",
        1,
    )

p.write_text(text, encoding="utf-8")
print("schema patched")
