#!/usr/bin/env node
/**
 * Seeds the golden flash landing product onto the store of drmohammedoffice@gmail.com.
 * Does not print secrets. Does not reset the database.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '..');
const OWNER_EMAIL = 'drmohammedoffice@gmail.com';
const LANDING_KEY = 'flash-12-courses';
const SKU = 'FLASH-12-COURSES';

function sanitizePixel(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d{10,20}$/.test(value)) return value;
  const fromInit = value.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/i);
  if (fromInit?.[1]) return fromInit[1];
  const fromTracker = value.match(/facebook\.com\/tr\?id=(\d{10,20})/i);
  if (fromTracker?.[1]) return fromTracker[1];
  return null;
}

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
    console.log(JSON.stringify({ ok: false, reason: 'owner_not_found' }));
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
        slug: `office-${crypto.randomBytes(3).toString('hex')}`,
        brandName: 'متجري',
        currency: 'IQD',
        defaultLocale: 'ar',
        isPublished: true,
        deliveryFee: 0,
      },
    });
  } else if (!settings.isPublished) {
    await prisma.storeSettings.update({ where: { teamId }, data: { isPublished: true } });
  }
  await prisma.storeSettings.update({
    where: { teamId },
    data: { giftWhatsappPhone: '9647864314333' },
  });
  settings = await prisma.storeSettings.findUnique({ where: { teamId } });
  if (!settings) throw new Error('Store settings missing after WhatsApp update');

  const existing = await prisma.product.findFirst({
    where: {
      teamId,
      OR: [{ sku: SKU }, { metadata: { path: ['landingKey'], equals: LANDING_KEY } }],
    },
  });
  const prevMeta =
    existing && existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? existing.metadata
      : {};
  const metadata = {
    landingKey: LANDING_KEY,
    compareAtPrice:
      Number(prevMeta.compareAtPrice) > 0 ? Number(prevMeta.compareAtPrice) : 100000,
    storageGb: '32 GB',
    freeDelivery: true,
    promoEndsAt:
      prevMeta.promoEndsAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    testimonials:
      Array.isArray(prevMeta.testimonials) && prevMeta.testimonials.length
        ? prevMeta.testimonials
        : [
            { name: 'أحمد من بغداد', text: 'كنت أضيع بين دورات مجانية. الفلاشة رتبت لي الموضوع: إعلان، تصميم، وفيديو في مكان واحد.', stars: 5, published: true },
            { name: 'سارة من البصرة', text: 'طلبت بدون تعقيد، والتوصيل وصل. Canva والريلز أفادوني من أول أسبوع تطبيق.', stars: 5, published: true },
            { name: 'حسين من أربيل', text: 'السعر مناسب مقارنة بما كنت أنوي أدفعه لدورات منفصلة. Premiere يحتاج وقت لكن البداية صارت أوضح.', stars: 5, published: true },
            { name: 'نور من النجف', text: 'المحتوى عملي أكثر من كلام نظري. طلبت لأخي أيضاً بعد ما شفت الملفات.', stars: 5, published: true },
            { name: 'علي من الموصل', text: 'أنا مبتدئ تماماً. دورة الإعلانات والبيع الرقمي ساعدتني أفهم من وين أبدأ.', stars: 5, published: true },
            { name: 'زينب من كربلاء', text: 'الفلاشة سهلة الاستخدام على اللابتوب. حبيت إن كل الدورات مجتمعة وما أحتاج روابط كثيرة.', stars: 5, published: true },
          ],
    metaPixelId: sanitizePixel(prevMeta.metaPixelId) || sanitizePixel(process.env.FLASH_META_PIXEL_ID) || null,
    ...(prevMeta.landingCopy ? { landingCopy: prevMeta.landingCopy } : {}),
    salePrice: Number(prevMeta.salePrice) > 0 ? Number(prevMeta.salePrice) : Number(existing?.unitPrice) > 0 ? Number(existing.unitPrice) : 35000,
  };
  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: 'فلاشة ذهبية – 12 دورة احترافية',
          sku: SKU,
          description:
            'فلاشة USB بسعة 32 GB تحتوي على 12 دورة احترافية في التسويق الرقمي، المحتوى، الفيديو، والذكاء الاصطناعي.',
          unitPrice: Number(existing.unitPrice) > 0 ? Number(existing.unitPrice) : 35000,
          priceCents: Math.round(Number(existing.unitPrice) > 0 ? Number(existing.unitPrice) : 35000),
          currency: 'IQD',
          quantity: Math.max(existing.quantity, 200),
          isActive: true,
          outOfStockManual: false,
          metadata,
        },
      })
    : await prisma.product.create({
        data: {
          teamId,
          name: 'فلاشة ذهبية – 12 دورة احترافية',
          sku: SKU,
          description:
            'فلاشة USB بسعة 32 GB تحتوي على 12 دورة احترافية في التسويق الرقمي، المحتوى، الفيديو، والذكاء الاصطناعي.',
          unitPrice: 35000,
          priceCents: 35000,
          currency: 'IQD',
          quantity: 500,
          isActive: true,
          metadata,
        },
      });

  const imageFiles = [
    path.join(ROOT, 'apps/web/public/store/flash-12-courses/hero-dark.jpg'),
    path.join(ROOT, 'apps/web/public/store/flash-12-courses/hero-light.jpg'),
  ];
  const storageRoot = process.env.LOCAL_STORAGE_ROOT || path.join(ROOT, 'storage');
  const existingImages = await prisma.productImage.count({ where: { productId: product.id } });
  if (existingImages === 0) {
    let position = 0;
    for (const file of imageFiles) {
      if (!fs.existsSync(file)) continue;
      const buffer = fs.readFileSync(file);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const key = `media/${teamId}/${Date.now()}-${hash}.jpg`.replace(/\\/g, '/');
      const dest = path.join(storageRoot, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buffer);
      await prisma.productImage.create({
        data: {
          productId: product.id,
          storageKey: key,
          mimeType: 'image/jpeg',
          fileName: path.basename(file),
          kind: 'IMAGE',
          position,
        },
      });
      position += 1;
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      teamIdPresent: true,
      productId: product.id,
      landingPath: '/store/flash-12-courses',
      storeSlug: settings.slug,
      pixelLinked: Boolean(product.metadata && product.metadata.metaPixelId),
    }),
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, errorName: error.name, message: String(error.message || '').slice(0, 200) }));
  process.exit(1);
});
