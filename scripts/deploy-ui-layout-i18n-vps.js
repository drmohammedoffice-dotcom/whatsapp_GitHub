#!/usr/bin/env node
/** Fixed sidebar scroll, CPR metric, AR/EN ads create, mobile cards. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/web/src/components/layout/app-shell.tsx',
  'apps/web/src/components/layout/topbar.tsx',
  'apps/web/src/components/tiktok/tiktok-integration-shell.tsx',
  'apps/web/src/app/tiktok/ads/create/page.tsx',
  'apps/web/src/lib/i18n/en.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/types.ts',
];

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

async function mkdirp(sftp, dir) {
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const p of parts) {
    cur += `/${p}`;
    await new Promise((resolve) => sftp.mkdir(cur, () => resolve()));
  }
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

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
    });
  }

  const cmd = `
set -e
cd ${PROJECT}
grep -q "h-\\[100dvh\\] overflow-hidden" apps/web/src/components/layout/app-shell.tsx
grep -q "costPerResult" apps/web/src/lib/i18n/en.ts
grep -q "tiktokAdsCreate" apps/web/src/lib/i18n/ar.ts
grep -q "costPerConversion" apps/web/src/app/tiktok/ads/create/page.tsx
grep -q "md:hidden" apps/web/src/app/tiktok/ads/create/page.tsx
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 12
curl -sS -o /dev/null -w 'web_home:%{http_code}\\n' https://www.chatloora.com/ || true
echo UI_LAYOUT_I18N_OK
`;
  const result = await exec(conn, cmd);
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
