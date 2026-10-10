#!/usr/bin/env node
/** Probe recommended CTAs for Smart+ Web Conversions. */
const path = require('path');
const PROJECT = '/root/whatsapp_GitHub';
const USER_ID = process.env.SMOKE_USER_ID || 'cmqwrykfu0007kbi7rpurdadf';
const ADVERTISER_ID = process.env.SMOKE_ADVERTISER_ID || '7648692609703084053';

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
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  return { app, requireApi, distRoot };
}

async function main() {
  const { app, requireApi, distRoot } = await bootstrapNest();
  try {
    const { TikTokAdsService } = requireApi(path.join(distRoot, 'integrations/tiktok-login-kit/tiktok-ads.service.js'));
    const { TikTokMarketingOAuthService } = requireApi(path.join(distRoot, 'integrations/tiktok-login-kit/tiktok-marketing-oauth.service.js'));
    const ads = app.get(TikTokAdsService);
    const oauth = app.get(TikTokMarketingOAuthService);
    const token = await oauth.getValidMarketingAccessToken(USER_ID);
    const http = ads.http || ads['http'];
    const queries = [
      { asset_type: 'CTA_NORMAL', content_type: 'LANDING_PAGE', objective_type: 'WEB_CONVERSIONS' },
      { asset_type: 'CTA_NORMAL', content_type: 'LANDING_PAGE', objective_type: 'TRAFFIC' },
      { asset_type: 'CTA_AUTO_OPTIMIZED', content_type: 'LANDING_PAGE' },
      { new_version: true, objective_type: 'WEB_CONVERSIONS', promotion_type: 'WEBSITE' },
    ];
    for (const params of queries) {
      try {
        const { data } = await http.get('/creative/cta/recommend/', {
          headers: { 'Access-Token': token },
          params: { advertiser_id: ADVERTISER_ID, ...params },
        });
        console.log('CTA_PROBE', JSON.stringify({ params, code: data?.code, message: data?.message, data: data?.data }));
      } catch (err) {
        console.log('CTA_PROBE_ERR', JSON.stringify({ params, err: err?.response?.data || String(err) }));
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('PROBE_FAIL', err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
