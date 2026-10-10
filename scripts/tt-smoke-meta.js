#!/usr/bin/env node
/** Inspect recent TikTok marketing advertisers/campaigns on VPS. */
const path = require('path');

async function loadPrisma() {
  const candidates = [
    path.join('/root/whatsapp_GitHub/node_modules/@prisma/client'),
    path.join('/root/whatsapp_GitHub/apps/api/node_modules/@prisma/client'),
    path.join('/root/whatsapp_GitHub/packages/database/node_modules/@prisma/client'),
  ];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(candidate);
    } catch (_) {
      // continue
    }
  }
  throw new Error('Prisma client not found');
}

async function main() {
  const { PrismaClient } = await loadPrisma();
  const prisma = new PrismaClient();
  try {
    const advertisers = await prisma.tikTokMarketingAdvertiser.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        userId: true,
        advertiserId: true,
        name: true,
        currency: true,
        updatedAt: true,
      },
    });
    const campaigns = await prisma.tikTokMarketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        campaignId: true,
        advertiserId: true,
        userId: true,
        name: true,
        objective: true,
        createdAt: true,
      },
    });
    console.log(JSON.stringify({ advertisers, campaigns }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
