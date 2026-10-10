#!/usr/bin/env node
/** Align the three live plans with WhatsApp, pixel, and description limits. */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const { PrismaClient } = createRequire(path.join(root, 'apps', 'api', 'package.json'))('@watsapp/database');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv(path.join(root, '.env'));
loadEnv(path.join(root, 'apps', 'api', '.env'));

const PACKS = [
  {
    wa: 1,
    pixels: 3,
    descriptionAr: 'رقم واتساب واحد و3 بكسلات، مع إنشاء حملات تيك توك ودعم فني.',
    descriptionEn: 'One WhatsApp number and 3 pixels, with professional TikTok campaigns and support.',
  },
  {
    wa: 3,
    pixels: 15,
    descriptionAr: '3 أرقام واتساب و15 بكسل، مع إنشاء الإعلانات وتقييمها بالذكاء الاصطناعي.',
    descriptionEn: '3 WhatsApp numbers and 15 pixels, with ad creation and AI campaign review.',
  },
  {
    wa: 10,
    pixels: -1,
    descriptionAr: '10 أرقام واتساب وبكسلات بلا حد، مع إنشاء الإعلانات وتقييمها بالذكاء الاصطناعي.',
    descriptionEn: '10 WhatsApp numbers and unlimited pixels, with ad creation and AI campaign review.',
  },
];

function tierOf(slug, index, count) {
  const key = String(slug || '').toLowerCase();
  if (key === 'basic' || key === 'starter') return 0;
  if (key === 'professional' || key === 'pro') return 1;
  if (key === 'business' || key === 'enterprise') return 2;
  return count <= 3 ? index : null;
}

const KEYS = ['maximum_whatsapp_numbers', 'maximum_tiktok_whatsapp_numbers', 'maximum_tiktok_pixels', 'maximum_pixels'];

async function main() {
  const prisma = new PrismaClient();
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
  });
  for (const [index, plan] of plans.entries()) {
    const tier = tierOf(plan.slug, index, plans.length);
    if (tier === null) continue;
    const pack = PACKS[tier];
    await prisma.subscriptionPlan.update({
      where: { id: plan.id },
      data: {
        description: pack.descriptionEn,
        descriptionAr: pack.descriptionAr,
        descriptionEn: pack.descriptionEn,
      },
    });
    for (const featureKey of KEYS) {
      const limitValue = featureKey.includes('pixel') ? pack.pixels : pack.wa;
      await prisma.planEntitlement.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: { enabled: true, limitValue },
        create: { planId: plan.id, featureKey, enabled: true, limitValue },
      });
    }
    console.log(`plan ${plan.slug} wa=${pack.wa} pixels=${pack.pixels}`);
  }
  await prisma.$disconnect();
  console.log('PLAN_PACKAGES_OK');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
