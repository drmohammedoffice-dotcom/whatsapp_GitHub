import { Body, Controller, Get, Param, Post, Req, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LandingCheckoutDto, StoreCheckoutDto } from './dto/store.dto';
import { ProductsService } from './products.service';

@ApiTags('Store Public')
@Controller('store/public')
export class StorePublicController {
  constructor(private readonly products: ProductsService) {}

  @Get('landing/:key')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  landing(@Param('key') key: string) {
    return this.products.getPublicLanding(key);
  }

  @Post('landing/:key/checkout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  landingCheckout(@Param('key') key: string, @Body() dto: LandingCheckoutDto, @Req() req: Request) {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : null) || req.ip || undefined;
    return this.products.checkoutLanding(key, {
      ...dto,
      ip: dto.ip || ip,
      userAgent: dto.userAgent || String(req.headers['user-agent'] || '').slice(0, 300) || undefined,
    });
  }

  @Get(':slug')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  get(@Param('slug') slug: string) {
    return this.products.getPublicStore(slug);
  }

  @Post(':slug/checkout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  checkout(@Param('slug') slug: string, @Body() dto: StoreCheckoutDto) {
    return this.products.checkoutPublic(slug, dto);
  }

  @Get(':slug/logo')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async logo(@Param('slug') slug: string) {
    const file = await this.products.openPublicLogo(slug);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }

  @Get(':slug/category/:id/image')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async categoryImage(@Param('slug') slug: string, @Param('id') id: string) {
    const file = await this.products.openPublicCategoryImage(slug, id);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }

  @Get(':slug/banner/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async banner(@Param('slug') slug: string, @Param('id') id: string) {
    const file = await this.products.openPublicBanner(slug, id);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }

  @Get(':slug/media/:mediaId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async media(@Param('slug') slug: string, @Param('mediaId') mediaId: string) {
    const file = await this.products.openPublicMedia(slug, mediaId);
    return new StreamableFile(file.stream, { type: file.mimeType });
  }
}
