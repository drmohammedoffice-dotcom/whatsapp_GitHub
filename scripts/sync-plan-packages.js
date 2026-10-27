#!/usr/bin/env node
/** Align the three live plans with prices, WhatsApp, pixels, and feature flags. */
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
    priceCents: 1500,
    yearlyPriceCents: 14400,
    isRecommended: false,
    wa: 1,
    pixels: 3,
    descriptionAr: 'رقم واتساب متصل واحد و3 بكسلات، مع ربط الحساب الإعلاني وإنشاء الحملات.',
    descriptionEn: 'One connected WhatsApp number and 3 pixels, with ad account linking and campaign creation.',
    features: {
      instant_forms_enabled: false,
      online_store_enabled: false,
      ai_campaign_review_enabled: false,
      ai_reply_enabled: false,
      creative_studio_enabled: false,
      voice_ai_enabled: false,
      whatsapp_api_enabled: false,
    },
  },
  {
    priceCents: 2500,
    yearlyPriceCents: 24000,
    isRecommended: false,
    wa: 3,
    pixels: 10,
    descriptionAr: '3 أرقام واتساب أعمال و10 بكسلات، مع إنشاء الإعلانات والاستمارات الفورية.',
    descriptionEn: '3 WhatsApp Business numbers and 10 pixels, with ads and instant product forms.',
    features: {
      instant_forms_enabled: true,
      online_store_enabled: false,
      ai_campaign_review_enabled: false,
      ai_reply_enabled: false,
      creative_studio_enabled: false,
      voice_ai_enabled: false,
      whatsapp_api_enabled: true,
    },
  },
  {
    priceCents: 3500,
    yearlyPriceCents: 33600,
    isRecommended: true,
    wa: 5,
    pixels: 20,
    descriptionAr: '5 أرقام واتساب و20 بكسل، مع تحليل الحملات بالذكاء الاصطناعي والمتجر والاستمارات ودعم فوري.',
    descriptionEn: '5 WhatsApp numbers and 20 pixels, with AI campaign analytics, store, forms, and priority support.',
    features: {
      instant_forms_enabled: true,
      online_store_enabled: true,
      ai_campaign_review_enabled: true,
      ai_reply_enabled: true,
      creative_studio_enabled: true,
      voice_ai_enabled: true,
      whatsapp_api_enabled: true,
    },
  },
];

function tierOf(slug, index, count) {
  const key = String(slug || '').toLowerCase();
  if (key === 'basic' || key === 'starter') return 0;
  if (key === 'professional' || key === 'pro') return 1;
  if (key === 'business' || key === 'enterprise') return 2;
  return count <= 3 ? index : null;
}

const LIMIT_KEYS = [
  'maximum_whatsapp_numbers',
  'maximum_tiktok_whatsapp_numbers',
  'maximum_tiktok_pixels',
  'maximum_pixels',
];

const FEATURE_DEFS = [
  {
    key: 'instant_forms_enabled',
    category: 'tiktok',
    valueType: 'BOOLEAN',
    nameAr: 'الاستمارات الفورية',
    nameEn: 'Instant forms',
    descriptionAr: 'إنشاء صفحات استمارة فورية للمنتجات',
    descriptionEn: 'Create instant form landing pages for products',
    sortOrder: 112,
  },
  {
    key: 'online_store_enabled',
    category: 'other',
    valueType: 'BOOLEAN',
    nameAr: 'المتجر الإلكتروني',
    nameEn: 'Online store',
    descriptionAr: 'تفعيل المتجر الإلكتروني داخل المنصة',
    descriptionEn: 'Enable the in-platform online store',
    sortOrder: 113,
  },
  {
    key: 'ai_campaign_review_enabled',
    category: 'ai',
    valueType: 'BOOLEAN',
    nameAr: 'تحليل الحملات بالذكاء الاصطناعي',
    nameEn: 'AI campaign analytics',
    descriptionAr: 'تحليل نتائج الحملات الإعلانية بالذكاء الاصطناعي',
    descriptionEn: 'AI-powered campaign performance analytics',
    sortOrder: 114,
  },
];

async function main() {
  const prisma = new PrismaClient();
  for (const feature of FEATURE_DEFS) {
    await prisma.featureDefinition.upsert({
      where: { key: feature.key },
      update: feature,
      create: feature,
    });
  }
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
        priceCents: pack.priceCents,
        yearlyPriceCents: pack.yearlyPriceCents,
        isRecommended: pack.isRecommended,
        description: pack.descriptionEn,
        descriptionAr: pack.descriptionAr,
        descriptionEn: pack.descriptionEn,
        sortOrder: tier + 1,
      },
    });
    for (const featureKey of LIMIT_KEYS) {
      const limitValue = featureKey.includes('pixel') ? pack.pixels : pack.wa;
      await prisma.planEntitlement.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: { enabled: true, limitValue },
        create: { planId: plan.id, featureKey, enabled: true, limitValue },
      });
    }
    for (const [featureKey, enabled] of Object.entries(pack.features)) {
      await prisma.planEntitlement.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: { enabled, limitValue: null },
        create: { planId: plan.id, featureKey, enabled, limitValue: null },
      });
    }
    console.log(
      `plan ${plan.slug} $${pack.priceCents / 100} wa=${pack.wa} pixels=${pack.pixels} recommended=${pack.isRecommended}`,
    );
  }
  await prisma.$disconnect();
  console.log('PLAN_PACKAGES_OK');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
