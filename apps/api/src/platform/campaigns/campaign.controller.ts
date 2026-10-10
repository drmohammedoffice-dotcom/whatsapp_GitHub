import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.campaigns.list(p.teamId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  get(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.campaigns.get(p.teamId, id);
  }

  @Post()
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(p.teamId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  update(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(p.teamId, id, dto);
  }

  @Get(':id/tracking-link')
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  trackingLink(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string) {
    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL');
    return { url: this.campaigns.trackingLink(p.teamId, id, webUrl) };
  }
}
