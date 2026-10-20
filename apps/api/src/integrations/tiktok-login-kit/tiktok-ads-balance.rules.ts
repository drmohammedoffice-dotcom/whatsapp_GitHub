import { TikTokAdsBalanceCheckoutStatus } from '@watsapp/database';
import { isAllowedTikTokBillingUrl, isValidTikTokAdvertiserId } from './tiktok-ads-balance-url';

export type BalanceCheckoutLike = {
  id: string;
  teamId: string;
  userId: string;
  status: TikTokAdsBalanceCheckoutStatus;
};

/** Returning to Chatloora never confirms payment. */
export function statusAfterUserReturn(
  current: TikTokAdsBalanceCheckoutStatus,
): TikTokAdsBalanceCheckoutStatus {
  if (
    current === TikTokAdsBalanceCheckoutStatus.CONFIRMED ||
    current === TikTokAdsBalanceCheckoutStatus.CANCELLED ||
    current === TikTokAdsBalanceCheckoutStatus.FAILED
  ) {
    return current;
  }
  return TikTokAdsBalanceCheckoutStatus.PENDING_CONFIRMATION;
}

export function confirmationSourceAfterReturn(): string {
  return 'user_return_unverified';
}

/** Balance snapshots are informational — never auto-confirm a specific top-up. */
export function canAutoConfirmFromBalanceChange(): boolean {
  return false;
}

export function statusAfterBalanceRefresh(
  current: TikTokAdsBalanceCheckoutStatus,
): TikTokAdsBalanceCheckoutStatus {
  if (
    current === TikTokAdsBalanceCheckoutStatus.REDIRECTED ||
    current === TikTokAdsBalanceCheckoutStatus.INITIATED
  ) {
    return TikTokAdsBalanceCheckoutStatus.EXTERNAL_CHECKOUT;
  }
  return current;
}

export function assertCheckoutScoped(
  row: BalanceCheckoutLike | null | undefined,
  teamId: string,
  userId: string,
): asserts row is BalanceCheckoutLike {
  if (!row || row.teamId !== teamId || row.userId !== userId) {
    throw new Error('CHECKOUT_NOT_FOUND');
  }
}

export function assertAdvertiserOwned(owned: boolean) {
  if (!owned) throw new Error('ADVERTISER_FORBIDDEN');
}

export function assertAdvertiserIdValid(advertiserId: string) {
  if (!isValidTikTokAdvertiserId(advertiserId)) throw new Error('ADVERTISER_INVALID');
}

export function assertDestinationSafe(url: string) {
  if (!isAllowedTikTokBillingUrl(url)) throw new Error('DESTINATION_UNTRUSTED');
}

export function isPaymentVerified(status: TikTokAdsBalanceCheckoutStatus): boolean {
  return status === TikTokAdsBalanceCheckoutStatus.CONFIRMED;
}
