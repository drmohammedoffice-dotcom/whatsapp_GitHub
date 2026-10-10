#!/usr/bin/env node
/** Deploy WhatsApp Embedded Signup number persistence fix. */
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
  'scripts/migrate-store-pixel-col.js',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ad-publish.service.ts',
  'apps/api/src/integrations/tiktok-login-kit/tiktok-ads.service.ts',
  'apps/api/src/instant-forms/instant-forms.service.ts',
  'apps/api/src/instant-forms/instant-forms.module.ts',
  'apps/api/src/instant-forms/instant-form-ai.service.ts',
  'apps/api/src/instant-forms/dto/instant-form.dto.ts',
  'apps/api/src/products/products.service.ts',
  'apps/api/src/products/products.module.ts',
  'apps/api/src/products/dto/store.dto.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.module.ts',
  'apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration-activation.service.ts',
  'apps/api/src/tiktok-integration/tiktok-integration.controller.ts',
  'apps/api/src/tiktok-integration/dto/tiktok-integration.dto.ts',
  'apps/web/src/app/tiktok/ads/new/page.tsx',
  'apps/web/src/app/tiktok/integration/wizard/page.tsx',
  'apps/web/src/app/tiktok/integration/page.tsx',
  'apps/web/src/app/tiktok/integration/forms/new/page.tsx',
  'apps/web/src/app/f/s/[code]/page.tsx',
  'apps/web/src/app/r/[slug]/route.ts',
  'apps/web/src/components/tiktok/pixel-edit-dialog.tsx',
  'apps/web/src/lib/tiktok-integration.ts',
  'apps/web/src/lib/tiktok-objective-lead-generation.ts',
  'apps/web/src/lib/tiktok-objective-web-conversions.ts',
  'apps/web/src/components/layout/nav-config.ts',
  'apps/web/src/components/tiktok/pixel-edit-dialog.tsx',
  'apps/web/src/components/store/public-storefront.tsx',
  'apps/web/src/components/instant-forms/public-form-client.tsx',
  'apps/web/src/lib/instant-forms/api.ts',
  'apps/web/src/lib/i18n/ar.ts',
  'apps/web/src/lib/i18n/en.ts',
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

function upload(conn, localRel, remoteRel) {
  const local = path.join(REPO, localRel);
  const remote = `${PROJECT}/${remoteRel || localRel}`.replace(/\\/g, '/');
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, (putErr) => {
        sftp.end();
        if (putErr) reject(putErr);
        else {
          console.log(`Upload ${localRel}`);
          resolve();
        }
      });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: USER,
      password: PASSWORD,
      readyTimeout: 120000,
      keepaliveInterval: 15000,
    });
  });
  for (const rel of UPLOAD_PATHS) {
    if (!fs.existsSync(path.join(REPO, rel))) throw new Error(`Missing ${rel}`);
    await upload(conn, rel, rel);
  }
  const build = await exec(
    conn,
    [
      `cd ${PROJECT}`,
      `node scripts/migrate-store-pixel-col.js`,
      `pnpm --filter @watsapp/database exec prisma generate`,
      `pnpm --filter @watsapp/api build`,
      `pnpm --filter @watsapp/web build`,
      `pm2 restart api web && pm2 save`,
      `sleep 12`,
      `curl -s -o /dev/null -w "api:%{http_code}\\n" http://127.0.0.1:4000/api/v1/health`,
      `curl -s -o /dev/null -w "plans:%{http_code}\\n" http://127.0.0.1:3000/plans`,
      `echo PRODUCT_UI_OK`,
    ].join(' && '),
  );
  conn.end();
  if (build.code !== 0 || !build.out.includes('PRODUCT_UI_OK')) {
    console.error('Deploy failed', build.code);
    process.exit(1);
  }
  console.log('Deploy finished OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
