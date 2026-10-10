#!/usr/bin/env node
/** Deploy IBRAQ Musk landing + checkout + seed for drmohammedoffice workspace. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'apps/api/src/products/landing.util.ts',
  'apps/api/src/products/landing.util.spec.ts',
  'apps/api/src/products/products.service.ts',
  'apps/api/src/products/store-public.controller.ts',
  'apps/api/src/products/dto/store.dto.ts',
  'apps/api/src/tiktok-integration/tiktok-pixel-inline.ts',
  'apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts',
  'apps/api/src/tiktok-integration/__tests__/tiktok-conversion-tracking.spec.ts',
  'apps/api/src/tiktok-integration/__tests__/tiktok-frontend-parity.spec.ts',
  'apps/web/tsconfig.json',
  'apps/web/src/lib/ibraq-musk.ts',
  'apps/web/src/lib/ibraq-musk.spec.ts',
  'apps/web/src/lib/tiktok-pixel-script.ts',
  'apps/web/src/components/store/ibraq-musk-landing.tsx',
  'apps/web/src/app/store/ibraq-musk/page.tsx',
  'apps/web/src/app/products/ibraq-musk/page.tsx',
  'apps/web/public/store/ibraq-musk/hero.svg',
  'scripts/seed-ibraq-musk-landing.cjs',
];

function exec(conn, command, timeoutMs = 600000) {
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
    await new Promise((resolve) => {
      sftp.mkdir(cur, () => resolve());
    });
  }
}

async function main() {
  let conn;
  for (let attempt = 1; attempt <= 6; attempt++) {
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
      if (attempt === 6) throw error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const rel of UPLOAD_PATHS) {
    const local = path.join(REPO, rel);
    if (!fs.existsSync(local)) {
      console.warn('Skip missing', rel);
      continue;
    }
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }

  const cmd = `
set -e
cd ${PROJECT}
cd apps/api && pnpm exec jest --runInBand src/products/landing.util.spec.ts src/tiktok-integration/__tests__/tiktok-frontend-parity.spec.ts
cd ${PROJECT}
pnpm --filter @watsapp/api typecheck
pnpm --filter @watsapp/web typecheck
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 12
node scripts/seed-ibraq-musk-landing.cjs
curl -sS -o /dev/null -w 'page:%{http_code}\\n' https://www.chatloora.com/store/ibraq-musk || true
curl -sS -o /dev/null -w 'alias:%{http_code}\\n' 'https://www.chatloora.com/products/ibraq-musk?utm_source=tiktok' || true
curl -sS -o /dev/null -w 'landing_api:%{http_code}\\n' http://127.0.0.1:4000/api/v1/store/public/landing/ibraq-musk || true
curl -sS http://127.0.0.1:4000/api/v1/store/public/landing/ibraq-musk | head -c 400 || true
echo
echo IBRAQ_DEPLOY_OK
`;
  const { code, errOut } = await exec(conn, cmd, 700000);
  conn.end();
  if (code !== 0) {
    console.error('Deploy failed with code', code);
    if (errOut) console.error(errOut.slice(-4000));
    process.exit(code || 1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
