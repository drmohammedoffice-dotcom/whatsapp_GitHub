#!/usr/bin/env node
/** Fix Lead Instant Form step-2 validation + disable auto draft restore. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');
const REL = 'apps/web/src/app/tiktok/ads/new/page.tsx';

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out, errOut });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => {
        const s = d.toString();
        errOut += s;
        process.stderr.write(s);
      });
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
      console.log('SSH connected');
      break;
    } catch (error) {
      console.error(`SSH attempt ${attempt} failed:`, error.message);
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      if (attempt === 8) throw error;
      await new Promise((r) => setTimeout(r, 6000 * attempt));
    }
  }

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  const local = path.join(REPO, REL);
  if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
  const remote = `${PROJECT}/${REL}`;
  console.log('Upload', REL);
  await new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });

  const cmd = `
set -e
cd ${PROJECT}
grep -q "phase: 'adgroup' | 'publish'" apps/web/src/app/tiktok/ads/new/page.tsx
grep -q "groupProblem(snapshotGroup(), 'adgroup')" apps/web/src/app/tiktok/ads/new/page.tsx
grep -q "إنشاء حملة جديدة يبدأ من الصفر" apps/web/src/app/tiktok/ads/new/page.tsx
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 10
curl -sS -o /dev/null -w 'web_home:%{http_code}\\n' https://www.chatloora.com/ || true
echo LEAD_FORM_DRAFT_FIX_OK
`;
  const result = await exec(conn, cmd);
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
