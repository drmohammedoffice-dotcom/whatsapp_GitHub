#!/usr/bin/env node
/**
 * Seeds IBRAQ Musk Collection landing product for drmohammedoffice@gmail.com.
 * Does not print secrets / tokens. Reports TikTok pixel readiness only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '..');
const OWNER_EMAIL = 'drmohammedoffice@gmail.com';
const LANDING_KEY = 'ibraq-musk';
const SKU = 'IBRAQ-MUSK-12x20';
const SALE_PRICE = 70000;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(ROOT, '.env'));
loadEnv(path.join(ROOT, 'apps/api/.env'));

async function main() {
  const fromDb = createRequire(path.join(ROOT, 'packages/database/package.json'));
  let PrismaClient;
  try {
    PrismaClient = fromDb('@prisma/client').PrismaClient;
  } catch {
    PrismaClient = require(path.join(ROOT, 'packages/database/dist/index.js')).PrismaClient;
  }
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.log(JSON.stringify({ ok: false, reason: 'owner_not_found', email: OWNER_EMAIL }));
    await prisma.$disconnect();
    process.exit(1);
  }
  const member =
    (await prisma.teamMember.findFirst({
      where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
      select: { teamId: true },
    })) || (await prisma.teamMember.findFirst({ where: { userId: user.id }, select: { teamId: true } }));
  if (!member) {
    console.log(JSON.stringify({ ok: false, reason: 'no_team' }));
    await prisma.$disconnect();
    process.exit(1);
  }
  const teamId = member.teamId;
  let settings = await prisma.storeSettings.findUnique({ where: { teamId } });
  if (!settings) {
    settings = await prisma.storeSettings.create({
      data: {
        teamId,
        slug: `ibraq-${crypto.randomBytes(3).toString('hex')}`,
        brandName: 'إبراق',
        currency: 'IQD',
        defaultLocale: 'ar',
        isPublished: true,
        deliveryFee: 0,
      },
    });
  } else {
    await prisma.storeSettings.update({
      where: { teamId },
      data: {
        isPublished: true,
        ...(settings.brandName ? {} : { brandName: 'إبراق' }),
      },
    });
    settings = await prisma.storeSettings.findUnique({ where: { teamId } });
  }

  const existing = await prisma.product.findFirst({
    where: {
      teamId,
      OR: [{ sku: SKU }, { metadata: { path: ['landingKey'], equals: LANDING_KEY } }],
    },
  });

  const metadata = {
    landingKey: LANDING_KEY,
    salePrice: SALE_PRICE,
    compareAtPrice: 140000,
    storageGb: '12×20ml',
    freeDelivery: false,
    modelNumber: '6287020285073',
    brand: 'IBRAQ',
    gender: 'unisex',
    scentCount: 12,
    volumeMlEach: 20,
    volumeMlTotal: 240,
  };

  let product;
  if (existing) {
    product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: 'مجموعة المسك من إبراق — 12×20 مل',
        sku: SKU,
        description:
          'مسكات إبراق الأصلية 100%. بوكس دائري فاخر يحتوي على 12 عطر مسك، كل عطر 20 مل. للجنسين.',
        unitPrice: SALE_PRICE,
        priceCents: SALE_PRICE,
        currency: 'IQD',
        quantity: Math.max(existing.quantity || 0, 100),
        outOfStockManual: false,
        isActive: true,
        metadata,
      },
    });
  } else {
    product = await prisma.product.create({
      data: {
        teamId,
        name: 'مجموعة المسك من إبراق — 12×20 مل',
        sku: SKU,
        description:
          'مسكات إبراق الأصلية 100%. بوكس دائري فاخر يحتوي على 12 عطر مسك، كل عطر 20 مل. للجنسين.',
        unitPrice: SALE_PRICE,
        priceCents: SALE_PRICE,
        currency: 'IQD',
        quantity: 200,
        outOfStockManual: false,
        isActive: true,
        metadata,
      },
    });
  }

  const pixelLinked = settings?.pixelIntegrationId
    ? await prisma.tikTokIntegration.findUnique({
        where: { id: settings.pixelIntegrationId },
        select: { id: true, pixelCode: true, pixelId: true, redirectDestinationType: true, wizardCompleted: true },
      })
    : null;
  const anyPixel = await prisma.tikTokIntegration.findFirst({
    where: { teamId, pixelCode: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, pixelCode: true, pixelId: true, redirectDestinationType: true, wizardCompleted: true },
  });
  const pixel = pixelLinked?.pixelCode ? pixelLinked : anyPixel;
  if (pixel?.id && settings && settings.pixelIntegrationId !== pixel.id) {
    await prisma.storeSettings.update({
      where: { teamId },
      data: { pixelIntegrationId: pixel.id },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: OWNER_EMAIL,
        teamId,
        storeSlug: settings?.slug,
        productId: product.id,
        landingKey: LANDING_KEY,
        landingUrl: `/store/${LANDING_KEY}`,
        aliasUrl: `/products/${LANDING_KEY}`,
        tiktokPixel: pixel
          ? {
              configured: true,
              integrationId: pixel.id,
              pixelCodeHint: String(pixel.pixelCode || '').slice(0, 4) + '…',
              destination: pixel.redirectDestinationType,
              wizardCompleted: pixel.wizardCompleted,
            }
          : {
              configured: false,
              reason: 'no_pixel_on_workspace',
              action: 'أنشئ/اربط بكسل تيك توك من تكامل تيك توك داخل Chatloora لهذا الحساب، ثم أعد فتح الصفحة.',
            },
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
