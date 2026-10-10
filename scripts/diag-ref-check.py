#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT id, text LIKE '%[ref:%' AS has_ref, length(text) len, "createdAt"
FROM "ConversationMessage"
WHERE id IN ('cmrgvcoqc000jkb0p30ueutlc','cmrgvbdfm00spkbj2twbn08bb');
"""
with c.open_sftp().file('/tmp/q5.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q5.sql',timeout=30000)
print(o.read().decode('utf-8','replace'))
c.close()
