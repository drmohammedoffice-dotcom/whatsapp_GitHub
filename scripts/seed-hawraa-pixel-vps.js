#!/usr/bin/env node
/** Find pixel named حوراء and re-send Contact/Lead/Purchase activation seeds. */
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';

function exec(conn, command, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Timed out after ${timeoutMs}ms`));
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

  const result = await exec(
    conn,
    `
set -e
cd ${PROJECT}/apps/api
node <<'NODE'
const path = require('path');
const { NestFactory } = require('@nestjs/core');

async function boot() {
  // Resolve AppModule from built dist
  const { AppModule } = require('./dist/apps/api/src/app.module');
  const { PrismaService } = require('./dist/apps/api/src/prisma/prisma.service');
  const { TikTokIntegrationActivationService } = require('./dist/apps/api/src/tiktok-integration/tiktok-integration-activation.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const activation = app.get(TikTokIntegrationActivationService);

    const rows = await prisma.tikTokIntegration.findMany({
      where: {
        OR: [
          { name: { contains: 'حوراء' } },
          { pixelName: { contains: 'حوراء' } },
          { name: { contains: 'بكسل حوراء' } },
          { pixelName: { contains: 'بكسل حوراء' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userId: true,
        name: true,
        pixelName: true,
        pixelId: true,
        pixelCode: true,
        advertiserId: true,
        pixelStatus: true,
        createdAt: true,
      },
    });

    console.log('MATCH_COUNT=' + rows.length);
    console.log('MATCHES=' + JSON.stringify(rows.map((r) => ({
      id: r.id,
      name: r.name,
      pixelName: r.pixelName,
      pixelId: r.pixelId,
      status: r.pixelStatus,
      createdAt: r.createdAt,
    })), null, 2));

    let target = rows[0];
    if (!target) {
      const latest = await prisma.tikTokIntegration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, name: true, pixelName: true, pixelId: true, userId: true, createdAt: true },
      });
      console.log('LATEST=' + JSON.stringify(latest, null, 2));
      throw new Error('Pixel حوراء not found');
    }

    console.log('TARGET=' + JSON.stringify({
      id: target.id,
      userId: target.userId,
      name: target.pixelName || target.name,
      pixelId: target.pixelId,
    }));

    await activation.activateIntegration(target.id, target.userId);
    console.log('ACTIVATION_OK');
  } finally {
    await app.close();
  }
}

boot().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
NODE
`,
  );

  conn.end();
  if (result.code !== 0) throw new Error('Remote activation failed');
  if (!result.out.includes('ACTIVATION_OK')) throw new Error('Activation did not report OK');
  console.log('Done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
