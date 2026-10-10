#!/usr/bin/env node
/** Hotfix CheckoutModal hooks order crash on /plans. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');
const REL = 'apps/web/src/components/billing/checkout-modal.tsx';

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`timeout ${timeoutMs}`));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    });
  });
}

async function main() {
  let conn;
  for (let attempt = 1; attempt <= 8; attempt++) {
    conn = new Client();
    try {
      await new Promise((resolve, reject) => {
        conn
          .on('ready', resolve)
          .on('error', reject)
          .connect({
            host: HOST,
            username: USER,
            password: PASSWORD,
            readyTimeout: 120000,
            keepaliveInterval: 15000,
          });
      });
      break;
    } catch (error) {
      console.error(`SSH attempt ${attempt} failed:`, error.message);
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      if (attempt === 8) throw error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  const local = path.join(REPO, REL);
  const remote = `${PROJECT}/${REL}`;
  console.log('Upload', REL);
  await new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });

  const result = await exec(
    conn,
    `
set -e
cd ${PROJECT}
grep -n "if (!plan) return null" apps/web/src/components/billing/checkout-modal.tsx
# ensure early return is AFTER useEffect
python3 - <<'PY'
from pathlib import Path
text = Path('apps/web/src/components/billing/checkout-modal.tsx').read_text(encoding='utf-8')
i_effect = text.find('useEffect(')
i_return = text.find('if (!plan) return null;')
if i_effect < 0 or i_return < 0 or i_return < i_effect:
    raise SystemExit(f'hooks order invalid effect={i_effect} return={i_return}')
print('hooks order OK')
PY
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 8
curl -sS -o /dev/null -w 'plans:%{http_code}\\n' https://www.chatloora.com/plans || true
echo CHECKOUT_HOOKS_FIX_OK
`,
  );
  conn.end();
  if (result.code !== 0) throw new Error(`deploy failed ${result.code}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
