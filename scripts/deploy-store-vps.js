#!/usr/bin/env node
/** Deploy My Store (متجري) catalog, AI wiring, and public storefront. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

const UPLOAD_PATHS = [
  'packages/database/prisma/schema.prisma',
  'packages/database/prisma/migrations/20260906020000_store_categories_themes/migration.sql',
  'packages/database/prisma/migrations/20260906030000_store_banners_order_items/migration.sql',
  'apps/api/src/products/store-themes.ts',
  'apps/web/src/lib/store-themes.ts',
  'apps/web/src/components/store/product-editor-dialog.tsx',
  'apps/web/src/app/globals.css',
  'apps/api/src/app.module.ts',
  'apps/api/src/bookings/bookings.service.ts',
  'apps/api/src/products/products.module.ts',
  'apps/api/src/products/products.service.ts',
  'apps/api/src/products/products.controller.ts',
  'apps/api/src/products/store.controller.ts',
  'apps/api/src/products/store-public.controller.ts',
  'apps/api/src/products/store.util.ts',
  'apps/api/src/products/dto/store.dto.ts',
  'apps/api/src/ai/ai.module.ts',
  'apps/api/src/ai/ai-orchestrator.service.ts',
  'apps/api/src/assistant/assistant-nav.ts',
  'apps/api/src/assistant/assistant-knowledge.catalog.ts',
  'apps/web/src/components/layout/nav-config.ts',
  'apps/web/src/components/layout/sidebar.tsx',
  'apps/web/src/lib/utils.ts',
  'apps/web/src/lib/i18n/types.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
  'apps/web/src/components/assistant/persistent-assistant.tsx',
  'apps/web/src/app/ai/page.tsx',
  'apps/web/src/app/ai/store/page.tsx',
  'apps/web/src/app/s/[slug]/page.tsx',
  'apps/web/src/app/s/[slug]/checkout/page.tsx',
  'apps/web/src/app/s/[slug]/p/[id]/page.tsx',
  'apps/web/src/components/store/public-storefront.tsx',
  'apps/web/src/app/bookings/page.tsx',
  'apps/web/src/components/ui/button.tsx',
];

function exec(conn, command, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, { timeout: timeoutMs }, (err, stream) => {
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
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000 });
  });

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

  const cmd = `
set -e
cd ${PROJECT}
pnpm --filter @watsapp/database prisma:generate
pnpm --filter @watsapp/database prisma:migrate
pnpm --filter @watsapp/api typecheck
pnpm --filter @watsapp/web typecheck
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart worker --update-env
pm2 restart web --update-env
sleep 12
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
echo STORE_DEPLOY_OK
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
  console.error(err);
  process.exit(1);
});
