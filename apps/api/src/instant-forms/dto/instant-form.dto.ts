import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InstantFormAdPlatform, InstantFormOrderStatus, InstantFormStatus } from '@watsapp/database';

export class CreateInstantFormDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  adAccountLabel?: string;

  @IsEnum(InstantFormAdPlatform)
  adPlatform!: InstantFormAdPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixelIntegrationId?: string | null;

  @IsOptional()
  @IsObject()
  draftDocument?: Record<string, unknown>;
}

export class GenerateInstantFormDto {
  @IsString()
  @MinLength(10)
  @MaxLength(6000)
  brief!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  productDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(800, { each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  offerBadge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extraNotes?: string;
}

export class UpdateInstantFormDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  adAccountLabel?: string;

  @IsOptional()
  @IsEnum(InstantFormAdPlatform)
  adPlatform?: InstantFormAdPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixelIntegrationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;

  @IsOptional()
  @IsObject()
  draftDocument?: Record<string, unknown>;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(InstantFormOrderStatus)
  status?: InstantFormOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  formId?: string;

  @IsOptional()
  @IsEnum(InstantFormOrderStatus)
  status?: InstantFormOrderStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sort?: 'submittedAt' | 'totalPrice' | 'status';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}

export class SubmitInstantFormDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  ttclid?: string;

  @IsOptional()
  @IsString()
  fbclid?: string;

  @IsOptional()
  @IsString()
  gclid?: string;

  /** Browser↔server TikTok event_id dedupe for Lead */
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  browser?: string;
}

export class ListFormsQueryDto {
  @IsOptional()
  @IsEnum(InstantFormStatus)
  status?: InstantFormStatus;

  @IsOptional()
  @IsString()
  q?: string;
}

export class SaveDraftDto {
  @IsObject()
  draftDocument!: Record<string, unknown>;
}
