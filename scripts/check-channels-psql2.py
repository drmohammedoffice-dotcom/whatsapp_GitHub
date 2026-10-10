#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

queries = [
    r"""SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%channel%' ORDER BY 1;""",
    r"""SELECT id, provider, status, "externalId",
       (metadata::jsonb ? 'tokenEnc') AS has_token_enc,
       metadata->>'pageId' AS page_id
       FROM "Channel"
       WHERE "teamId"='cmqwrykfu0009kbi7ccvvax53'
       AND provider IN ('META_MESSENGER','META_INSTAGRAM','TELEGRAM','TELEGRAM_USER');""",
    r"""SELECT id, provider, status,
       (metadata::jsonb ? 'tokenEnc') AS has_token_enc,
       metadata->>'pageId' AS page_id
       FROM "Channel"
       WHERE id IN ('cmr67lwlq0006kbzjnka96q5p','cmr67xudn002gkbvtev4kaaxi');""",
]

for q in queries:
    cmd = f"PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -c '{q}'"
    print('=== QUERY ===')
    _, o, e = c.exec_command(cmd, timeout=30)
    print(o.read().decode('utf-8', 'replace'))
    err = e.read().decode('utf-8', 'replace')
    if err.strip() and 'ERROR' in err:
        print('ERR:', err)

c.close()
