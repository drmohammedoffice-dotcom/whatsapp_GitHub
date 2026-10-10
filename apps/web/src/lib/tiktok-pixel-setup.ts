import { refreshTikTokPixelStatus, type TikTokIntegrationView } from '@/lib/tiktok-integration';

export type TikTokSetupAutomationResult = {
  activated: boolean;
  pixelStatus?: string;
};

/** Best-effort activation via hidden iframe + Events API refresh (no visible popup). */
export async function runTikTokSetupAutomation(
  integration: Pick<TikTokIntegrationView, 'id' | 'setupPageUrl' | 'trackingUrl' | 'pixelStatus'>,
): Promise<TikTokSetupAutomationResult> {
  if (integration.setupPageUrl) {
    loadHiddenFrame(integration.setupPageUrl, 25_000);
  }

  if (integration.trackingUrl) {
    loadHiddenFrame(integration.trackingUrl, 15_000);
  }

  // امنح تيك توك وقتاً قصيراً ثم حدّث الحالة عدة مرات
  await sleep(1200);
  let lastStatus = integration.pixelStatus;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const updated = await refreshTikTokPixelStatus(integration.id);
      lastStatus = updated.pixelStatus;
      if (
        updated.pixelStatus === 'active'
        || updated.eventsApiConnected
        || updated.eventsApiStatus === 'connected'
      ) {
        return { activated: true, pixelStatus: updated.pixelStatus };
      }
    } catch {
      /* keep trying */
    }
    await sleep(1500);
  }

  return {
    activated: lastStatus === 'active',
    pixelStatus: lastStatus,
  };
}

function loadHiddenFrame(url: string, ms: number) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.src = url;
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), ms);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
