import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  outOfStockManual?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: object;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  outOfStockManual?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: object;
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsIn(['FIXED', 'VARIABLE'])
  deliveryMode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsObject()
  deliveryRates?: Record<string, number>;

  @IsOptional()
  @IsString()
  giftWhatsappPhone?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  promoEnabled?: boolean;

  @IsOptional()
  @IsString()
  promoEndsAt?: string | null;

  @IsOptional()
  @IsString()
  promoText?: string | null;

  @IsOptional()
  @IsString()
  themeKey?: string;

  @IsOptional()
  @IsObject()
  themeColors?: Record<string, string>;
}

export class StoreCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StoreThemeDto {
  @IsString()
  name!: string;

  @IsObject()
  colors!: Record<string, string>;
}

export class ApplyStoreThemeDto {
  @IsOptional()
  @IsString()
  themeKey?: string;

  @IsOptional()
  @IsString()
  customThemeId?: string;

  @IsOptional()
  @IsObject()
  colors?: Record<string, string>;
}

export class StoreBannerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  position?: number;

  /** cover | contain — عرض الصورة داخل إطار البانر الثابت */
  @IsOptional()
  @IsString()
  imageObjectFit?: string;

  @IsOptional()
  @IsString()
  imageObjectPosition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  imageZoom?: number;
}

export class ReorderIdsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export class StoreCheckoutItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  colorId?: string;

  @IsOptional()
  @IsString()
  colorName?: string;
}

export class StoreCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreCheckoutItemDto)
  items!: StoreCheckoutItemDto[];

  @IsString()
  phone!: string;

  @IsString()
  governorate!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  ttclid?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class LandingCheckoutDto {
  @IsString()
  phone!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2)
  packQty?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  ttclid?: string;

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
  eventId?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class StoreColorSwatchDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsString()
  hex!: string;
}

export class SaveStoreColorPaletteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreColorSwatchDto)
  colors!: StoreColorSwatchDto[];
}

export class ApplyStoreColorsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreColorSwatchDto)
  colors?: StoreColorSwatchDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsBoolean()
  linkImagesByPosition?: boolean;

  @IsOptional()
  @IsBoolean()
  saveAsStorePalette?: boolean;
}
