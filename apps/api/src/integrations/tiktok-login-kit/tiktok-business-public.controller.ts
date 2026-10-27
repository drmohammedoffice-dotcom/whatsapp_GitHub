import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../billing/subscription.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../common/principal';
import type { UploadedMediaFile } from '../../common/uploaded-media-file';
import { TikTokAdPublishService, type PublishTikTokAdInput } from './tiktok-ad-publish.service';
import { TikTokAdsBalanceService } from './tiktok-ads-balance.service';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';
import { TikTokBusinessService } from './tiktok-business.service';

class StartTikTokAdsBalanceCheckoutDto {
  @ApiProperty({ description: 'TikTok advertiser id owned by the current user' })
  @IsString()
  @MinLength(5)
  advertiserId!: string;
}

@ApiTags('TikTok Business Public API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('api/tiktok-business')
export class TikTokBusinessPublicController {
  constructor(
    private readonly business: TikTokBusinessService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly publishAds: TikTokAdPublishService,
    private readonly adsBalance: TikTokAdsBalanceService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'TikTok Business connection status' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getStatus(principal.userId!);
  }

  @Get('advertisers')
  @ApiOperation({ summary: 'List connected TikTok advertiser accounts' })
  advertisers(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getAdvertisers(principal.userId!);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List TikTok campaigns with statistics' })
  campaigns(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getCampaigns(principal.userId!);
  }

  @Get('adgroups')
  @ApiOperation({ summary: 'List TikTok ad groups' })
  adGroups(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getAdGroups(principal.userId!);
  }

  @Get('ads')
  @ApiOperation({ summary: 'List TikTok ads' })
  ads(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getAds(principal.userId!);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'TikTok Business analytics summary' })
  analytics(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getAnalytics(principal.userId!);
  }

  @Get('mappings')
  @ApiOperation({ summary: 'List TikTok to WhatsApp number mappings' })
  mappings(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.listMappings(principal.teamId!);
  }

  @Post('mappings')
  @ApiOperation({ summary: 'Create or update TikTok to WhatsApp mapping' })
  upsertMapping(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body()
    body: {
      id?: string;
      advertiserId?: string | null;
      campaignId?: string | null;
      adGroupId?: string | null;
      adId?: string | null;
      whatsappNumber: string;
      isActive?: boolean;
    },
  ) {
    return this.business.upsertMapping(principal.teamId!, body);
  }

  @Get('ads/create-options')
  @ApiOperation({ summary: 'Pixels, countries, interests, and identities for the ad wizard' })
  createOptions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
  ) {
    return this.publishAds.options(principal.userId!, advertiserId, principal.teamId ?? undefined);
  }

  @Get('ads/targeting-extras')
  @ApiOperation({ summary: 'Carriers and ISPs for selected locations' })
  targetingExtras(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('locationIds') locationIds?: string,
  ) {
    const ids = String(locationIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.publishAds.targetingExtras(principal.userId!, advertiserId, ids);
  }

  @Post('ads/audience-estimate')
  @ApiOperation({ summary: 'Estimate available audience size for current targeting' })
  audienceEstimate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body()
    body: {
      advertiserId: string;
      objective: string;
      locationIds: string[];
      gender?: string;
      ageGroups?: string[];
      interestCategoryIds?: string[];
      languageCodes?: string[];
      devices?: 'ALL' | 'ANDROID' | 'IOS';
      placementMode?: 'AUTOMATIC' | 'MANUAL';
      placements?: string[];
    },
  ) {
    return this.publishAds.estimateAudience(principal.userId!, body);
  }

  @Get('ads/videos')
  @ApiOperation({ summary: 'Spark videos for an authorized TikTok identity' })
  createVideos(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('identityId') identityId: string,
    @Query('identityType') identityType: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.publishAds.videos(principal.userId!, advertiserId, identityId, identityType, cursor);
  }

  @Get('ads/creative-preview')
  @ApiOperation({ summary: 'Poster, playable URL, or TikTok preview for a published ad' })
  creativePreview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('adId') adId?: string,
    @Query('itemId') itemId?: string,
    @Query('identityId') identityId?: string,
    @Query('identityType') identityType?: string,
  ) {
    return this.publishAds.creativePreview(principal.userId!, {
      advertiserId,
      adId,
      itemId,
      identityId,
      identityType,
    });
  }

  @Get('ads/campaign')
  @ApiOperation({ summary: 'Full settings for one TikTok campaign' })
  campaignDetail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('campaignId') campaignId: string,
  ) {
    return this.publishAds.campaignDetail(principal.userId!, advertiserId, campaignId);
  }

  @Get('ads/performance')
  @ApiOperation({ summary: 'Campaign stats for a date range' })
  performance(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('light') light?: string,
  ) {
    return this.publishAds.performance(principal.userId!, advertiserId, startDate, endDate, {
      light: light === '1' || light === 'true',
    });
  }

  @Post('ads/rename')
  @ApiOperation({ summary: 'Rename a TikTok campaign' })
  renameCampaign(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; campaignId: string; name: string },
  ) {
    return this.publishAds.renameCampaign(principal.userId!, body.advertiserId, body.campaignId, body.name ?? '');
  }

  @Post('ads/delete')
  @ApiOperation({ summary: 'Delete one or more TikTok campaigns' })
  deleteCampaigns(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; campaignIds: string[] },
  ) {
    return this.publishAds.deleteCampaigns(principal.userId!, body.advertiserId, body.campaignIds ?? []);
  }

  @Post('ads/creative/status')
  @ApiOperation({ summary: 'Enable or pause one video inside a campaign' })
  setCampaignVideoStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adId: string; enabled: boolean },
  ) {
    return this.publishAds.setCampaignVideoStatus(principal.userId!, body.advertiserId, body.adId, Boolean(body.enabled));
  }

  @Post('ads/creative/delete')
  @ApiOperation({ summary: 'Delete one video from a campaign' })
  deleteCampaignVideo(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adId: string },
  ) {
    return this.publishAds.deleteCampaignVideo(principal.userId!, body.advertiserId, body.adId);
  }

  @Post('ads/creative/duplicate')
  @ApiOperation({ summary: 'Duplicate one video inside the same campaign' })
  duplicateCampaignVideo(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adId: string },
  ) {
    return this.publishAds.duplicateCampaignVideo(principal.userId!, body.advertiserId, body.adId);
  }

  @Post('ads/creative/replace')
  @ApiOperation({ summary: 'Replace the video used by one ad' })
  replaceCampaignVideo(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adId: string; itemId?: string; identityId?: string; identityType?: string; authCode?: string },
  ) {
    return this.publishAds.replaceCampaignVideo(principal.userId!, body.advertiserId, body.adId, body);
  }

  @Post('ads/adgroup/status')
  @ApiOperation({ summary: 'Enable or pause one TikTok ad group' })
  setAdGroupStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adGroupId: string; enabled: boolean },
  ) {
    return this.publishAds.setAdGroupDelivery(principal.userId!, body.advertiserId, body.adGroupId, Boolean(body.enabled));
  }

  @Post('ads/status')
  @ApiOperation({ summary: 'Enable or pause a TikTok campaign and its ads' })
  setCampaignStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; campaignId: string; enabled: boolean },
  ) {
    return this.publishAds.setCampaignDelivery(principal.userId!, body.advertiserId, body.campaignId, Boolean(body.enabled));
  }

  @Post('ads/budget')
  @ApiOperation({ summary: 'Update an ad group daily or total budget' })
  updateBudget(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; adGroupId: string; budget: number },
  ) {
    return this.publishAds.updateBudget(principal.userId!, body.advertiserId, body.adGroupId, Number(body.budget));
  }

  @Get('ads/topup-quote')
  @ApiOperation({ summary: 'Currency, tax, and balance for an advertiser top-up' })
  topupQuote(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
  ) {
    return this.publishAds.topupQuote(principal.userId!, advertiserId);
  }

  @Post('ads/topup')
  @ApiOperation({ summary: 'Start a card payment to top up an advertiser account' })
  startTopup(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; amount: number },
  ) {
    return this.publishAds.startTopup(principal.userId!, principal.teamId!, body.advertiserId, Number(body.amount));
  }

  @Get('ads/topup-invoices')
  @ApiOperation({ summary: 'TikTok advertiser top-up invoices' })
  topupInvoices(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.publishAds.listTopups(principal.teamId!);
  }

  @Get('ads/balance/advertisers')
  @ApiOperation({ summary: 'List TikTok advertisers available for external Ads Manager balance top-up' })
  balanceAdvertisers(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adsBalance.listAdvertisers(principal.userId!);
  }

  @Post('ads/balance/checkout')
  @ApiOperation({
    summary: 'Start external TikTok Ads Manager billing redirect (payment on TikTok, not Chatloora)',
  })
  startBalanceCheckout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: StartTikTokAdsBalanceCheckoutDto,
  ) {
    return this.adsBalance.startCheckout({
      userId: principal.userId!,
      teamId: principal.teamId!,
      advertiserId: body.advertiserId,
    });
  }

  @Get('ads/balance/checkouts')
  @ApiOperation({ summary: 'List external TikTok Ads balance checkout sessions for this team/user' })
  listBalanceCheckouts(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adsBalance.listCheckouts(principal.teamId!, principal.userId!);
  }

  @Get('ads/balance/checkouts/:id')
  @ApiOperation({ summary: 'Get one TikTok Ads balance checkout session' })
  getBalanceCheckout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.adsBalance.getCheckout(principal.teamId!, principal.userId!, id);
  }

  @Post('ads/balance/checkouts/:id/returned')
  @ApiOperation({
    summary: 'Mark user returned from TikTok (does NOT confirm payment)',
  })
  markBalanceReturned(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.adsBalance.markReturned(principal.teamId!, principal.userId!, id);
  }

  @Post('ads/balance/checkouts/:id/refresh')
  @ApiOperation({
    summary: 'Refresh advertiser balance snapshot (informational — not payment confirmation)',
  })
  refreshBalanceCheckout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.adsBalance.refreshStatus(principal.teamId!, principal.userId!, id);
  }

  @Post('ads/balance/checkouts/:id/cancel')
  @ApiOperation({ summary: 'Cancel an open TikTok Ads balance checkout session' })
  cancelBalanceCheckout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.adsBalance.cancelCheckout(principal.teamId!, principal.userId!, id);
  }

  @Post('ads/spark-preview')
  @ApiOperation({ summary: 'Authorize a TikTok Spark ad code and return the video' })
  sparkPreview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; authCode: string },
  ) {
    return this.publishAds.previewSpark(principal.userId!, body.advertiserId, body.authCode);
  }

  @Get('ads/instant-forms')
  @ApiOperation({ summary: 'List TikTok Lead Instant Forms (LEAD_GEN) from advertiser library' })
  listInstantForms(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('page') page?: string,
  ) {
    return this.publishAds.listLeadInstantForms(principal.userId!, advertiserId, Number(page || 1) || 1);
  }

  @Post('ads/instant-forms/tip-token')
  @ApiOperation({ summary: 'Create Tip Editor SDK token to open TikTok Instant Form editor' })
  tipSdkToken(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string },
  ) {
    return this.publishAds.tipSdkToken(principal.userId!, body.advertiserId);
  }

  @Post('ads/instant-forms/rename')
  @ApiOperation({ summary: 'Rename a TikTok Instant Form (best-effort API)' })
  renameInstantForm(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId: string; pageId: string; title: string },
  ) {
    return this.publishAds.renameLeadInstantForm(
      principal.userId!,
      body.advertiserId,
      body.pageId ?? '',
      body.title ?? '',
    );
  }

  @Get('ads/display-cards')
  @ApiOperation({ summary: 'List Display Card interactive add-ons (library)' })
  listDisplayCards(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('advertiserId') advertiserId: string,
    @Query('page') page?: string,
  ) {
    return this.publishAds.listDisplayCards(principal.userId!, advertiserId, Number(page || 1) || 1);
  }

  @Post('ads/display-cards')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create Display Card from image + pixel tracking URL' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  createDisplayCard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @UploadedFile() file: UploadedMediaFile,
    @Body() body: { advertiserId?: string; pixelId?: string; landingPageUrl?: string; title?: string },
  ) {
    if (!principal.teamId) {
      throw new BadRequestException('جلسة غير مكتملة — أعد تسجيل الدخول');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('ارفع صورة بطاقة العرض');
    }
    if (!String(body.advertiserId ?? '').trim()) {
      throw new BadRequestException('اختر الحساب الإعلاني أولاً');
    }
    return this.publishAds.createDisplayCard(principal.userId!, principal.teamId, {
      advertiserId: String(body.advertiserId ?? ''),
      pixelId: body.pixelId ? String(body.pixelId) : undefined,
      landingPageUrl: body.landingPageUrl ? String(body.landingPageUrl) : undefined,
      title: body.title ? String(body.title) : undefined,
      file,
    });
  }

  @Post('ads/publish')
  @ApiOperation({ summary: 'Create a TikTok campaign, ad group, and Spark ads' })
  publishAd(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: PublishTikTokAdInput,
  ) {
    return this.publishAds.publish(principal.userId!, principal.teamId!, body);
  }

  @Post('ads/publish-bundle')
  @ApiOperation({ summary: 'Create a TikTok campaign with all ad groups and ads sequentially' })
  publishAdBundle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { groups?: PublishTikTokAdInput[] } | PublishTikTokAdInput[],
  ) {
    const groups = Array.isArray(body) ? body : (body?.groups ?? []);
    return this.publishAds.publishBundle(principal.userId!, principal.teamId!, groups);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync advertisers, campaigns, ad groups, ads' })
  sync(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { advertiserId?: string | null } = {},
  ) {
    const advertiserId = body.advertiserId ? String(body.advertiserId) : null;
    if (advertiserId) {
      return this.business.syncAdvertiser(principal.userId!, principal.teamId!, advertiserId);
    }
    return this.business.syncAll(principal.userId!, principal.teamId!);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect TikTok Business integration' })
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.disconnect(principal.userId!, principal.teamId);
  }
}

@ApiTags('TikTok Marketing OAuth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/auth/tiktok-business')
export class TikTokMarketingOAuthGetLoginController {
  constructor(private readonly marketingOAuth: TikTokMarketingOAuthService) {}

  @Get('login')
  @ApiOperation({ summary: 'Start TikTok Marketing OAuth using GET (compat route)' })
  login(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query('returnOrigin') returnOrigin?: string) {
    return this.marketingOAuth.startLogin(principal.userId!, principal.teamId, { returnOrigin });
  }
}
