#!/usr/bin/env node
/** Deploy flash landing page + public checkout + seed owner product. */
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
  'apps/api/src/products/landing-copy.util.ts',
  'apps/api/src/products/store.util.ts',
  'apps/api/src/products/products.service.ts',
  'apps/api/src/products/store-public.controller.ts',
  'apps/api/src/products/dto/store.dto.ts',
  'apps/api/src/bookings/dto/booking.dto.ts',
  'apps/api/src/bookings/bookings.service.ts',
  'apps/web/next.config.ts',
  'apps/web/src/lib/meta-pixel.ts',
  'apps/web/src/components/store/course-brands.tsx',
  'apps/web/src/components/store/meta-pixel-tag.tsx',
  'apps/web/src/components/integrations/facebook-sdk-loader.tsx',
  'apps/web/src/components/store/flash-landing.tsx',
  'apps/web/src/components/store/flash-landing-data.ts',
  'apps/web/src/components/store/flash-landing-copy-editor.tsx',
  'apps/web/src/components/store/product-editor-dialog.tsx',
  'apps/web/src/app/store/flash-12-courses/page.tsx',
  'apps/web/src/components/assistant/persistent-assistant.tsx',
  'apps/web/src/app/bookings/page.tsx',
  'apps/web/src/lib/parse-iqd.ts',
  'apps/web/src/app/ai/store/page.tsx',
  'apps/web/public/store/flash-12-courses/hero-dark.jpg',
  'apps/web/public/store/flash-12-courses/hero-light.jpg',
  'apps/web/public/store/flash-12-courses/courses/01.jpg',
  'apps/web/public/store/flash-12-courses/courses/02.jpg',
  'apps/web/public/store/flash-12-courses/courses/03.jpg',
  'apps/web/public/store/flash-12-courses/courses/04.jpg',
  'apps/web/public/store/flash-12-courses/courses/05.jpg',
  'apps/web/public/store/flash-12-courses/courses/06.jpg',
  'apps/web/public/store/flash-12-courses/courses/07.jpg',
  'apps/web/public/store/flash-12-courses/courses/08.jpg',
  'apps/web/public/store/flash-12-courses/courses/09.jpg',
  'apps/web/public/store/flash-12-courses/courses/10.jpg',
  'apps/web/public/store/flash-12-courses/courses/11.jpg',
  'apps/web/public/store/flash-12-courses/courses/12.jpg',
  'scripts/seed-flash-landing.cjs',
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

function sanitizePixelForDeploy(raw) {
  const value = String(raw || '').trim();
  if (/^\d{10,20}$/.test(value)) return value;
  return '';
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
    if (!fs.existsSync(local)) throw new Error(`Missing: ${local}`);
    const remote = `${PROJECT}/${rel.replace(/\\/g, '/')}`;
    await mkdirp(sftp, path.posix.dirname(remote));
    console.log('Upload', rel);
    await uploadFile(sftp, local, remote);
  }

  const pixelEnv = sanitizePixelForDeploy(process.env.FLASH_META_PIXEL_ID);
  const cmd = `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/api typecheck
pnpm --filter @watsapp/web typecheck
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart web --update-env
sleep 10
FLASH_META_PIXEL_ID=${JSON.stringify(pixelEnv)} node scripts/seed-flash-landing.cjs
curl -sS -o /dev/null -w 'page:%{http_code}\\n' https://www.chatloora.com/store/flash-12-courses || true
curl -sS -o /dev/null -w 'landing_api:%{http_code}\\n' http://127.0.0.1:4000/api/v1/store/public/landing/flash-12-courses || true
echo FLASH_DEPLOY_OK
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
