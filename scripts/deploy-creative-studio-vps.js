#!/usr/bin/env node
/** Deploy Creative Studio (phases 2–4) to the production VPS. */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const REPO = path.resolve(__dirname, '..');

function walk(relDir) {
  const abs = path.join(REPO, relDir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) stack.push(full);
      else out.push(path.relative(REPO, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

const UPLOAD_PATHS = [
  ...walk('apps/api/src/creative-studio'),
  ...walk('apps/api/src/storage'),
  'apps/api/src/admin/admin.module.ts',
  'apps/api/src/admin/controllers/admin-creative.controller.ts',
  'apps/api/src/admin/services/admin-creative.service.ts',
  'apps/api/src/app.module.ts',
  'apps/api/src/config/env.ts',
  'apps/api/src/billing/feature-registry.ts',
  'apps/api/src/billing/plan-entitlements.service.ts',
  'apps/api/src/billing/billing.service.ts',
  'apps/api/src/queues/queues.constants.ts',
  'apps/api/src/queues/queues.module.ts',
  'apps/worker/src/worker.module.ts',
  'apps/worker/src/creative-studio.processor.ts',
  'packages/database/prisma/schema.prisma',
  'packages/database/prisma/migrations/20260909010000_creative_studio/migration.sql',
  'packages/database/prisma/migrations/20260909020000_creative_studio_phase3/migration.sql',
  'packages/database/prisma/migrations/20260909030000_creative_studio_phase4/migration.sql',
  'apps/web/src/app/ai/creative/page.tsx',
  'apps/web/src/app/admin/creative/page.tsx',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
  'apps/web/src/lib/i18n/types.ts',
  'apps/web/src/lib/admin-api.ts',
  'apps/web/src/lib/plan-limits.ts',
  'apps/web/src/components/layout/nav-config.ts',
  'apps/web/src/app/ai/page.tsx',
  'apps/web/src/components/billing/plan-upgrade-dialog.tsx',
  'docs/CREATIVE_STUDIO.md',
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
  const files = [...new Set(UPLOAD_PATHS)];
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

  for (const rel of files) {
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
pnpm --filter @watsapp/worker typecheck
pnpm --filter @watsapp/web typecheck
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/worker build
pnpm --filter @watsapp/web build
pm2 restart api --update-env
pm2 restart worker --update-env
pm2 restart web --update-env
sleep 12
curl -sS -o /dev/null -w 'web:%{http_code}\\n' https://www.chatloora.com/ || true
curl -sS -o /dev/null -w 'creative:%{http_code}\\n' https://www.chatloora.com/ai/creative || true
echo CREATIVE_STUDIO_DEPLOY_OK
`;
  const { code, errOut } = await exec(conn, cmd, 800000);
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
