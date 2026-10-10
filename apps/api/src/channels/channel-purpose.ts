import { ChannelPurpose } from '@watsapp/database';

export type ChannelPurposeValue = 'inbox' | 'tracking';

export type ChannelMetadataWithPurpose = {
  purpose?: ChannelPurposeValue;
  integrationId?: string;
  phoneNumber?: string;
  connectionSource?: string;
};

export function toPrismaPurpose(purpose?: ChannelPurposeValue | ChannelPurpose | null): ChannelPurpose {
  if (purpose === 'tracking' || purpose === ChannelPurpose.TRACKING) return ChannelPurpose.TRACKING;
  return ChannelPurpose.INBOX;
}

export function fromPrismaPurpose(purpose?: ChannelPurpose | null): ChannelPurposeValue {
  return purpose === ChannelPurpose.TRACKING ? 'tracking' : 'inbox';
}

export function readChannelPurpose(
  channelOrMetadata: { purpose?: ChannelPurpose | null; metadata?: unknown } | unknown,
): ChannelPurposeValue {
  if (channelOrMetadata && typeof channelOrMetadata === 'object') {
    const row = channelOrMetadata as { purpose?: ChannelPurpose | null; metadata?: unknown };
    if (row.purpose === ChannelPurpose.TRACKING) return 'tracking';
    if (row.purpose === ChannelPurpose.INBOX) return 'inbox';
    const metaPurpose = (row.metadata as ChannelMetadataWithPurpose | null)?.purpose;
    if (metaPurpose === 'tracking') return 'tracking';
    // Legacy: metadata-only purpose on a bare metadata object
    if ((channelOrMetadata as ChannelMetadataWithPurpose).purpose === 'tracking') return 'tracking';
  }
  return 'inbox';
}

export function isTrackingChannel(
  channelOrMetadata: { purpose?: ChannelPurpose | null; metadata?: unknown } | unknown,
): boolean {
  return readChannelPurpose(channelOrMetadata) === 'tracking';
}

export function trackingChannelMetadata(input?: {
  integrationId?: string;
  phoneNumber?: string;
}): ChannelMetadataWithPurpose {
  return {
    purpose: 'tracking',
    connectionSource: 'tiktok_tracking',
    ...(input?.integrationId ? { integrationId: input.integrationId } : {}),
    ...(input?.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
  };
}
