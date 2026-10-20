import { Controller, Get, Param, Post, Body, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SubmitInstantFormDto } from './dto/instant-form.dto';
import { InstantFormsService } from './instant-forms.service';

@ApiTags('Instant Forms Public')
@Controller('instant-forms/public')
export class InstantFormsPublicController {
  constructor(private readonly forms: InstantFormsService) {}

  @Get('assets')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async asset(@Query('key') key: string) {
    const file = await this.forms.openPublicAsset(key);
    return new StreamableFile(file.stream, { type: file.type });
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('slug') slug: string) {
    return this.forms.getPublicBySlug(slug);
  }

  @Post(':slug/submit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submit(@Param('slug') slug: string, @Body() dto: SubmitInstantFormDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
      req.ip ||
      undefined;
    return this.forms.submitPublic(slug, dto, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
