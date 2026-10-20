import { AiTrainingPlatform, ChannelProvider } from '@watsapp/database';
import { BadRequestException } from '@nestjs/common';

export const AI_TRAINING_PLATFORMS = [
  AiTrainingPlatform.WHATSAPP,
  AiTrainingPlatform.TELEGRAM,
  AiTrainingPlatform.MESSENGER,
  AiTrainingPlatform.INSTAGRAM,
  AiTrainingPlatform.TIKTOK,
] as const;

export function trainingDocTitle(platform: AiTrainingPlatform) {
  return `__ai_training_instructions__${platform}`;
}

export function parseAiTrainingPlatform(value?: string | null): AiTrainingPlatform {
  const normalized = String(value ?? AiTrainingPlatform.WHATSAPP).toUpperCase();
  if (normalized === 'META') return AiTrainingPlatform.MESSENGER;
  if (normalized === 'FACEBOOK') return AiTrainingPlatform.MESSENGER;
  if ((AI_TRAINING_PLATFORMS as readonly string[]).includes(normalized)) {
    return normalized as AiTrainingPlatform;
  }
  throw new BadRequestException(`Invalid AI platform: ${value}`);
}

export function channelProviderToAiPlatform(provider: ChannelProvider): AiTrainingPlatform {
  switch (provider) {
    case ChannelProvider.WHATSAPP_BAILEYS:
    case ChannelProvider.WHATSAPP_CLOUD:
      return AiTrainingPlatform.WHATSAPP;
    case ChannelProvider.TELEGRAM:
    case ChannelProvider.TELEGRAM_USER:
      return AiTrainingPlatform.TELEGRAM;
    case ChannelProvider.META_MESSENGER:
      return AiTrainingPlatform.MESSENGER;
    case ChannelProvider.META_INSTAGRAM:
      return AiTrainingPlatform.INSTAGRAM;
    default:
      return AiTrainingPlatform.WHATSAPP;
  }
}

export function platformChannelLabel(platform: AiTrainingPlatform): string {
  switch (platform) {
    case AiTrainingPlatform.WHATSAPP:
      return 'WhatsApp';
    case AiTrainingPlatform.TELEGRAM:
      return 'Telegram';
    case AiTrainingPlatform.MESSENGER:
      return 'Facebook Messenger';
    case AiTrainingPlatform.INSTAGRAM:
      return 'Instagram';
    case AiTrainingPlatform.TIKTOK:
      return 'TikTok';
    default:
      return platform;
  }
}
