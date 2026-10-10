const { Client } = require('ssh2');
const conn = new Client();
const remoteScript = `
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const forms = await p.instantForm.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true, name: true, status: true, shortCode: true,
      pixelIntegrationId: true, teamId: true, updatedAt: true,
    },
  });
  const orders = await p.instantFormOrder.findMany({
    orderBy: { submittedAt: 'desc' },
    take: 10,
    select: {
      id: true, orderNumber: true, formId: true, teamId: true,
      ttclid: true, submittedAt: true, totalPrice: true,
    },
  });
  const ints = await p.tikTokIntegration.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true, name: true, pixelCode: true, redirectDestinationType: true,
      externalRedirectUrl: true, lastEventName: true, lastEventSentAt: true,
      lastApiError: true, defaultOptimizationEvent: true, teamId: true,
    },
  });
  const convs = await p.tikTokIntegrationConversion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true, integrationId: true, eventName: true, orderId: true,
      contactSent: true, tiktokStatus: true, tiktokError: true,
      createdAt: true, valueAmount: true,
    },
  });
  console.log(JSON.stringify({ forms, orders, ints, convs }, null, 2));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
`;

conn
  .on('ready', () => {
    conn.exec(
      [
        'cd /root/whatsapp_GitHub/packages/database',
        `cat > ./check-form-pixel.js <<'EOF'\n${remoteScript}\nEOF`,
        'node ./check-form-pixel.js',
        'rm -f ./check-form-pixel.js',
      ].join(' && '),
      (err, stream) => {
        if (err) {
          console.error(err);
          conn.end();
          return;
        }
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
        stream.on('close', (code) => {
          conn.end();
          process.exit(code || 0);
        });
      },
    );
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({
    host: '161.97.140.171',
    username: 'root',
    password: process.env.VPS_PASSWORD || '',
    readyTimeout: 120000,
  });
