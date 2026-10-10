import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MinLength, ValidateIf } from 'class-validator';
import { TikTokOptimizationEvent } from '@watsapp/database';
import { TIKTOK_OPTIMIZATION_EVENTS } from '../tiktok-integration.constants';

export class IntegrationIdDto {
  @IsOptional()
  @IsString()
  integrationId?: string;
}

export class SelectAdvertiserDto extends IntegrationIdDto {
  @IsString()
  advertiserId!: string;

  @IsOptional()
  @IsString()
  advertiserName?: string;

  @IsOptional()
  @IsString()
  pixelName?: string;

  @IsOptional()
  @IsString()
  useExistingPixelId?: string;

  @IsOptional()
  createNewPixel?: boolean;
}

export class SaveWhatsappDto extends IntegrationIdDto {
  @IsOptional()
  @IsIn(['WHATSAPP_NUMBER', 'EXTERNAL_URL', 'INSTANT_FORM', 'STORE'])
  destinationType?: 'WHATSAPP_NUMBER' | 'EXTERNAL_URL' | 'INSTANT_FORM' | 'STORE';

  @ValidateIf((dto: SaveWhatsappDto) => !dto.destinationType || dto.destinationType === 'WHATSAPP_NUMBER')
  @IsString()
  @MinLength(8)
  whatsappNumber?: string;

  @ValidateIf((dto: SaveWhatsappDto) => dto.destinationType === 'EXTERNAL_URL')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  externalRedirectUrl?: string;

  /** استمارة فورية موجودة لربطها ببكسل INSTANT_FORM — إن تُركت فارغة تُنشأ استمارة جديدة */
  @IsOptional()
  @IsString()
  instantFormId?: string;
}

export class CreatePixelDto extends IntegrationIdDto {
  @IsOptional()
  @IsString()
  pixelName?: string;
}

export class SaveOptimizationEventDto extends IntegrationIdDto {
  @IsIn(TIKTOK_OPTIMIZATION_EVENTS)
  defaultOptimizationEvent!: TikTokOptimizationEvent;

  @IsOptional()
  @IsString()
  customEventName?: string;

  @IsOptional()
  enabledEvents?: TikTokOptimizationEvent[];

  @IsOptional()
  @IsString()
  redirectMessage?: string;
}

export class UpdateEventConfigurationsDto {
  @IsIn(TIKTOK_OPTIMIZATION_EVENTS)
  defaultOptimizationEvent!: TikTokOptimizationEvent;

  @IsOptional()
  @IsString()
  customEventName?: string;

  @IsOptional()
  enabledEvents?: TikTokOptimizationEvent[];
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  whatsappNumber?: string;

  @IsOptional()
  @IsIn(['WHATSAPP_NUMBER', 'EXTERNAL_URL', 'INSTANT_FORM', 'STORE'])
  destinationType?: 'WHATSAPP_NUMBER' | 'EXTERNAL_URL' | 'INSTANT_FORM' | 'STORE';

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  externalRedirectUrl?: string;

  @IsOptional()
  @IsString()
  instantFormId?: string;

  @IsOptional()
  @IsIn(TIKTOK_OPTIMIZATION_EVENTS)
  defaultOptimizationEvent?: TikTokOptimizationEvent;

  @IsOptional()
  @IsString()
  customEventName?: string;

  @IsOptional()
  enabledEvents?: TikTokOptimizationEvent[];

  @IsOptional()
  @IsString()
  redirectMessage?: string;
}

export class SaveEventsApiCredentialsDto {
  @IsString()
  @MinLength(4)
  pixelCode!: string;

  @IsOptional()
  @IsString()
  pixelId?: string;

  @IsOptional()
  @IsString()
  pixelName?: string;

  @IsString()
  @MinLength(20)
  accessToken!: string;
}

export class MarkQualifiedLeadDto {
  @IsString()
  conversationId!: string;
}

export class ToggleTrackingDto {
  @IsBoolean()
  enabled!: boolean;
}
