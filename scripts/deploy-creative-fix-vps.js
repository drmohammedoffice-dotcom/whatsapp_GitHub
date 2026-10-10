#!/usr/bin/env node
/** Fix Creative Studio queue crash + worker JWT + Gemini studio tools UI. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/creative-studio/creative-entitlements.module.ts',
  'apps/api/src/creative-studio/creative-studio.core.module.ts',
  'apps/api/src/creative-studio/creative-studio.service.ts',
  'apps/api/src/creative-studio/dto/creative.dto.ts',
  'apps/api/src/creative-studio/providers/gemini.provider.ts',
  'apps/web/src/app/ai/creative/page.tsx',
];

function exec(conn, command, timeoutMs = 700000) {
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

function uploadFile(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
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
  for (const rel of UPLOAD_PATHS) {
    if (!fs.existsSync(path.join(REPO, rel))) throw new Error(`Missing ${rel}`);
  }
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: 'root',
      password: PASSWORD,
      readyTimeout: 120000,
    });
  });
  console.log('SSH connected');
  const sftp = await new Promise((resolve, reject) => conn.sftp((e, s) => (e ? reject(e) : resolve(s))));
  for (const rel of UPLOAD_PATHS) {
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, path.join(REPO, rel), remote);
  }

  const { code } = await exec(
    conn,
    `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/api typecheck
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/worker typecheck
pnpm --filter @watsapp/worker build
pnpm --filter @watsapp/web build
pm2 restart api worker web --update-env
sleep 10
curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://www.chatloora.com/api/v1/health || true
curl -sS -o /dev/null -w 'creative:%{http_code}\\n' https://www.chatloora.com/ai/creative || true
echo CREATIVE_FIX_DEPLOY_OK
`,
  );
  conn.end();
  if (code !== 0) process.exit(code || 1);
  console.log('Deploy finished OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
