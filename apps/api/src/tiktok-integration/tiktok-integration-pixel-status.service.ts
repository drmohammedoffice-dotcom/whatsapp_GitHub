import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';

export type PixelStatusValue =
  | 'pending'
  | 'waiting_for_activity'
  | 'active'
  | 'manual_setup_required'
  | 'unknown';

@Injectable()
export class TikTokIntegrationPixelStatusService {
  private readonly logger = new Logger(TikTokIntegrationPixelStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollPixelStatuses() {
    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: {
        pixelId: { not: null },
        advertiserId: { not: null },
        wizardCompleted: true,
        billingSuspended: false,
      },
      select: {
        id: true,
        userId: true,
        pixelId: true,
        advertiserId: true,
        pixelStatus: true,
      },
      take: 50,
      orderBy: { lastPixelStatusCheckAt: 'asc' },
    });

    for (const row of integrations) {
      try {
        await this.refreshIntegrationStatus(row.id, row.userId, row.pixelId!, row.advertiserId!);
      } catch (err) {
        this.logger.warn(
          `Pixel status poll failed integration=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async refreshIntegrationStatus(
    integrationId: string,
    userId: string,
    pixelId: string,
    advertiserId: string,
  ) {
    const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const pixels = await this.ads.listPixels(accessToken, advertiserId);
    const match = pixels.find((p) => p.pixel_id === pixelId);
    let { status, message } = this.mapTikTokPixelStatus(match?.activity_status);

    const existing = await this.prisma.tikTokIntegration.findUnique({
      where: { id: integrationId },
      select: {
        eventsApiConnected: true,
        eventsApiStatus: true,
        lastEventSentAt: true,
        activatedAt: true,
      },
    });
    const eventsLive =
      Boolean(existing?.eventsApiConnected)
      || existing?.eventsApiStatus === 'connected'
      || Boolean(existing?.lastEventSentAt);

    // لا نُرجع البكسل إلى «بانتظار النشاط» إذا Events API يعمل — واجهة تيك توك قد تتأخر
    if (
      eventsLive
      && (status === 'waiting_for_activity' || status === 'pending' || status === 'unknown')
    ) {
      status = 'active';
      message = 'مفعّل عبر Events API';
    }

    await this.prisma.tikTokIntegration.update({
      where: { id: integrationId },
      data: {
        pixelStatus: status,
        pixelStatusMessage: message,
        lastPixelStatusCheckAt: new Date(),
      },
    });

    return { status, message };
  }

  mapTikTokPixelStatus(raw: unknown): { status: PixelStatusValue; message: string | null } {
    const value = String(raw ?? '').toLowerCase().trim();

    // TikTok Ads API commonly returns ENABLE / ACTIVE / 1 for a usable pixel.
    if (
      value === '1' ||
      value === 'active' ||
      value === 'enable' ||
      value === 'enabled' ||
      value.includes('active') ||
      value.includes('enable')
    ) {
      return { status: 'active', message: null };
    }

    if (
      value === '0' ||
      value.includes('waiting') ||
      value.includes('no_recent_activity') ||
      value.includes('inactive') ||
      value.includes('disable')
    ) {
      return {
        status: 'waiting_for_activity',
        message:
          'Pixel is waiting for activity. Open your tracking URL or complete setup in TikTok Events Manager.',
      };
    }

    if (
      value.includes('setup') ||
      value.includes('verification') ||
      value.includes('finish')
    ) {
      return {
        status: 'manual_setup_required',
        message:
          'This ad account requires completing Pixel setup manually in TikTok Events Manager per TikTok policies.',
      };
    }

    if (!value) {
      return { status: 'pending', message: null };
    }

    return { status: 'unknown', message: `TikTok reported status: ${raw}` };
  }

  /** Browser activation must run in a real browser — server fetch cannot execute TikTok SDK. */
  triggerBrowserActivation(pixelCode: string, events: string[] = ['PageView', 'ViewContent']) {
    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
    const eventsParam = encodeURIComponent(events.join(','));
    const url = `${webUrl}/tiktok/activate/${encodeURIComponent(pixelCode)}?events=${eventsParam}`;
    this.logger.log(`[Activation] browser setup page: ${url}`);
    return url;
  }
}
