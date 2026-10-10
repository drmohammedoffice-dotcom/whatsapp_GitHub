#!/usr/bin/env node
/**
 * Real Smart+ publish smoke test then delete.
 * Usage on VPS: node /tmp/tt-smoke-publish.js
 */
const path = require('path');

const PROJECT = '/root/whatsapp_GitHub';
const USER_ID = process.env.SMOKE_USER_ID || 'cmqwrykfu0007kbi7rpurdadf';
const ADVERTISER_ID = process.env.SMOKE_ADVERTISER_ID || '7648692609703084053';

async function loadPrisma() {
  const candidates = [
    path.join(PROJECT, 'node_modules/@prisma/client'),
    path.join(PROJECT, 'apps/api/node_modules/@prisma/client'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_) {}
  }
  throw new Error('Prisma client not found');
}

async function bootstrapNest() {
  const apiDir = path.join(PROJECT, 'apps/api');
  process.chdir(apiDir);
  const { createRequire } = require('module');
  const requireApi = createRequire(path.join(apiDir, 'package.json'));
  try { requireApi('dotenv').config({ path: path.join(apiDir, '.env') }); } catch (_) {}
  try { requireApi('dotenv').config({ path: path.join(apiDir, '.env.local') }); } catch (_) {}

  const distRoot = path.join(apiDir, 'dist/apps/api/src');
  const { NestFactory } = requireApi('@nestjs/core');
  const { AppModule } = requireApi(path.join(distRoot, 'app.module.js'));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  return { app, requireApi, distRoot };
}

async function main() {
  const { app, requireApi, distRoot } = await bootstrapNest();
  try {
    const { TikTokAdPublishService } = requireApi(path.join(distRoot, 'integrations/tiktok-login-kit/tiktok-ad-publish.service.js'));
    const publish = app.get(TikTokAdPublishService);

    console.log('Loading options for', ADVERTISER_ID);
    const options = await publish.options(USER_ID, ADVERTISER_ID);
    const pixel = (options.pixels || []).find((p) => p.trackingUrl) || (options.pixels || [])[0];
    const region = (options.regions || []).find((r) => /iraq|العراق|IQ/i.test(`${r.name} ${r.regionCode}`))
      || (options.regions || [])[0];
    const identity = (options.identities || [])[0];
    if (!pixel?.pixelId) throw new Error('No pixel on advertiser');
    if (!region?.locationId) throw new Error('No region on advertiser');
    if (!identity?.identityId) throw new Error('No linked TikTok identity');

    console.log('Fetching identity videos…');
    const { TikTokAdsService } = requireApi(path.join(distRoot, 'integrations/tiktok-login-kit/tiktok-ads.service.js'));
    const { TikTokMarketingOAuthService } = requireApi(path.join(distRoot, 'integrations/tiktok-login-kit/tiktok-marketing-oauth.service.js'));
    const ads = app.get(TikTokAdsService);
    const oauth = app.get(TikTokMarketingOAuthService);
    const token = await oauth.getValidMarketingAccessToken(USER_ID);
    const page = await ads.listIdentityVideos(token, ADVERTISER_ID, identity.identityId, identity.identityType);
    const video = (page.videos || [])[0];
    if (!video?.itemId) throw new Error('No identity video available for smoke test');

    const campaignName = `ChatLoora smoke ${Date.now().toString().slice(-6)}`;
    const budget = (options.advertiser?.currency || 'IQD').toUpperCase() === 'IQD' ? 50000 : 20;
    console.log('Publishing Smart+ smoke campaign', {
      campaignName,
      pixelId: pixel.pixelId,
      locationId: region.locationId,
      identityId: identity.identityId,
      itemId: video.itemId,
      budget,
    });

    const teamId = null;
    const result = await publish.publish(USER_ID, teamId, {
      advertiserId: ADVERTISER_ID,
      campaignName,
      objective: 'WEB_CONVERSIONS',
      smartPlus: true,
      salesDestination: 'WEBSITE',
      destination: 'PIXEL',
      pixelId: pixel.pixelId,
      optimizationEvent: 'CONSULT',
      usePlatformLink: Boolean(pixel.trackingUrl),
      landingPageUrl: pixel.trackingUrl || 'https://example.com',
      locationIds: [region.locationId],
      gender: 'GENDER_UNLIMITED',
      ageGroups: [],
      interestCategoryIds: [],
      languageCodes: [],
      spendingPower: 'ALL',
      audienceIds: [],
      excludedAudienceIds: [],
      smartInterestBehavior: false,
      placementMode: 'MANUAL',
      placements: ['PLACEMENT_TIKTOK'],
      includeSearchResult: true,
      budgetMode: 'BUDGET_MODE_DAY',
      budget,
      bidStrategy: 'HIGHEST',
      acceleratedDelivery: false,
      scheduleMode: 'CONTINUOUS',
      scheduleStartDate: new Date().toISOString().slice(0, 10),
      devices: 'ALL',
      networkTypes: ['WIFI', '2G', '3G', '4G', '5G'],
      carrierIds: [],
      ispIds: [],
      devicePriceMode: 'ALL',
      callToAction: 'LEARN_MORE',
      allowComments: true,
      allowDownload: false,
      allowShare: true,
      creatives: [{
        name: `${campaignName} ad`,
        itemId: video.itemId,
        identityId: identity.identityId,
        identityType: identity.identityType,
        identityAuthorizedBcId: identity.identityAuthorizedBcId || undefined,
      }],
    });

    console.log('PUBLISH_OK', JSON.stringify(result));
    const campaignId = result.campaignId;
    if (campaignId) {
      console.log('Deleting smoke campaign', campaignId);
      await publish.deleteCampaigns(USER_ID, ADVERTISER_ID, [campaignId]);
      console.log('DELETE_OK', campaignId);
    }
    console.log('SMOKE_PASS');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
