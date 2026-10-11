#!/usr/bin/env node
/** Deploy TikTok ads thumbnail + campaign toggle fixes. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts',
  'apps/web/src/app/tiktok/ads/create/page.tsx',
  'apps/web/src/components/tiktok/video-thumb.tsx',
];

function exec(conn, command, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
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

async function mkdirp(sftp, dir) {
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const p of parts) {
    cur += `/${p}`;
    await new Promise((resolve) => sftp.mkdir(cur, () => resolve()));
  }
}

async function main() {
  if (!PASSWORD) throw new Error('Set VPS_PASSWORD env var');
  const conn = new Client();
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
  const result = await exec(
    conn,
    `
set -e
cd ${PROJECT}
grep -q "rememberStatus" apps/web/src/app/tiktok/ads/create/page.tsx
grep -q "listSparkMedia" apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts
grep -q "slice(0, 120)" apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -sS -o /dev/null -w 'ads:%{http_code}\\n' https://www.chatloora.com/tiktok/ads/create || true
echo ADS_THUMB_TOGGLE_OK
`,
  );
  conn.end();
  if (result.code !== 0) throw new Error(`Remote deploy failed with code ${result.code}`);
  console.log('Deploy finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
