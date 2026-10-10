#!/usr/bin/env node
/** Diagnose Gemini key + admin login after configure (no secrets printed). */
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'drmohammedoffice@gmail.com';
const ADMIN_NEW_PASSWORD = process.env.ADMIN_NEW_PASSWORD || '';

function exec(conn, command, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`timeout ${timeoutMs}`));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out, errOut });
      });
      stream.on('data', (d) => {
        out += d.toString();
      });
      stream.stderr.on('data', (d) => {
        errOut += d.toString();
      });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: 'root',
      password: PASSWORD,
      readyTimeout: 60000,
    });
  });

  const diag = `
set -e
cd ${PROJECT}
echo '--- pm2 ---'
pm2 list
echo '--- api log ---'
pm2 logs api --lines 40 --nostream || true
echo '--- env keys present (names only) ---'
python3 - <<'PY'
from pathlib import Path
keys = []
for line in Path('${PROJECT}/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1)
        k=k.strip(); v=v.strip()
        if k in ('AI_API_KEY','AI_API_KEY_1','OPENAI_API_KEY','AI_GATEWAY_BASE_URL','AI_GATEWAY_CHAT_MODEL','AI_API_BASE_URL','OPENAI_API_BASE_URL','CREATIVE_OPENAI_TEXT_MODEL'):
            print(k, 'set=' + str(bool(v)), 'len=' + str(len(v)), 'prefix=' + (v[:6] if v else ''))
PY

echo '--- gemini probes ---'
python3 - <<'PY'
import json, urllib.request, urllib.error
from pathlib import Path
env={}
for line in Path('${PROJECT}/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1); env[k.strip()]=v.strip()
key=env.get('AI_API_KEY_1') or env.get('AI_API_KEY') or ''
models=['gemini-2.0-flash','gemini-2.5-flash','gemini-1.5-flash','gemini-2.0-flash-001']
# OpenAI-compatible
for model in models:
    url='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    req=urllib.request.Request(url, data=json.dumps({'model':model,'messages':[{'role':'user','content':'hi'}],'max_tokens':5}).encode(), headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            print('openai_compat', model, r.status, 'OK')
            break
    except urllib.error.HTTPError as e:
        body=e.read().decode('utf-8','replace')[:180]
        print('openai_compat', model, e.code, body)
    except Exception as e:
        print('openai_compat', model, type(e).__name__, str(e)[:120])

# Native generateContent with ?key=
for model in models:
    url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key='+key
    req=urllib.request.Request(url, data=json.dumps({'contents':[{'parts':[{'text':'hi'}]}]}).encode(), headers={'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            print('native', model, r.status, 'OK')
            break
    except urllib.error.HTTPError as e:
        body=e.read().decode('utf-8','replace')[:180]
        print('native', model, e.code, body)
    except Exception as e:
        print('native', model, type(e).__name__, str(e)[:120])
PY

sleep 5
curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
`;

  const { out, errOut } = await exec(conn, diag, 180000);
  process.stdout.write(out);
  if (errOut) process.stderr.write(errOut.slice(-4000));

  const payload = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_NEW_PASSWORD });
  const login = await exec(
    conn,
    `curl -sS -X POST https://www.chatloora.com/api/v1/admin/auth/login -H 'content-type: application/json' -d ${JSON.stringify(payload)}`,
    30000,
  );
  const ok = login.out.includes('accessToken');
  console.log('ADMIN_LOGIN_OK:', ok);
  if (!ok) console.log('LOGIN_BODY_SNIP:', login.out.slice(0, 300));

  conn.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
