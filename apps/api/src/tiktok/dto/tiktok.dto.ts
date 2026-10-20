import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TikTokEventType } from '@watsapp/database';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class TikTokConnectDto {
  @ApiPropertyOptional({ description: 'Optional advertiser ID to pre-select after OAuth' })
  @IsOptional()
  @IsString()
  advertiserId?: string;
}

export class TikTokDisconnectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TikTokCustomEventDto {
  @ApiProperty({ enum: TikTokEventType, default: TikTokEventType.CUSTOM })
  @IsEnum(TikTokEventType)
  eventType!: TikTokEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clickId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class TikTokCreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalCampaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;
}

export class TikTokUpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eventsApiEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  syncIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultWhatsAppNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingRedirectMessage?: string;
}

export class TikTokEventsQueryDto {
  @ApiPropertyOptional({ enum: TikTokEventType })
  @IsOptional()
  @IsEnum(TikTokEventType)
  eventType?: TikTokEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class TikTokAppCredentialsDto {
  @ApiProperty({ description: 'TikTok Developer App Client Key (App ID)' })
  @IsString()
  @MinLength(4)
  clientKey!: string;

  @ApiPropertyOptional({ description: 'Leave empty to keep existing secret when updating' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional({ description: 'OAuth redirect URI registered in TikTok Developer portal' })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
