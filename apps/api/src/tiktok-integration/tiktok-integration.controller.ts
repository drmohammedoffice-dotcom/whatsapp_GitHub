import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../billing/subscription.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import {
  CreatePixelDto,
  MarkQualifiedLeadDto,
  SaveEventsApiCredentialsDto,
  SaveOptimizationEventDto,
  SaveWhatsappDto,
  SelectAdvertiserDto,
  UpdateIntegrationDto,
} from './dto/tiktok-integration.dto';
import { TikTokIntegrationService } from './tiktok-integration.service';
import { TikTokTrackingPhonesService } from './tiktok-tracking-phones.service';
import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';
import { TikTokLifecycleEventsService } from './tiktok-lifecycle-events.service';

@ApiTags('TikTok Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('api/tiktok-integration')
export class TikTokIntegrationController {
  constructor(
    private readonly integration: TikTokIntegrationService,
    private readonly trackingPhones: TikTokTrackingPhonesService,
    private readonly eventsApi: TikTokEventsApiCredentialsService,
    private readonly lifecycle: TikTokLifecycleEventsService,
  ) {}

  @Get('integrations')
  @ApiOperation({ summary: 'List all TikTok pixel integrations for the team' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.integration.listIntegrations(principal.userId!, principal.teamId);
  }

  @Post('integrations')
  @ApiOperation({ summary: 'Create a new TikTok pixel setup' })
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.integration.createIntegration(principal.userId!, principal.teamId);
  }

  @Get('wizard')
  @ApiOperation({ summary: 'Get TikTok integration wizard state' })
  wizard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('integrationId') integrationId?: string,
    @Query('new') createNew?: string,
  ) {
    return this.integration.getWizardState(
      principal.userId!,
      principal.teamId,
      integrationId,
      createNew === '1' || createNew === 'true',
    );
  }

  @Post('oauth/start')
  @ApiOperation({ summary: 'Start TikTok Business OAuth (wizard step 1)' })
  startOAuth(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { integrationId?: string; returnOrigin?: string },
  ) {
    return this.integration.startOAuth(
      principal.userId!,
      principal.teamId,
      body.integrationId,
      body.returnOrigin,
    );
  }

  @Post('wizard/advertiser')
  @ApiOperation({ summary: 'Wizard step 2 — select advertiser' })
  selectAdvertiser(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SelectAdvertiserDto,
  ) {
    return this.integration.saveAdvertiser(principal.userId!, principal.teamId, body);
  }

  @Post('wizard/whatsapp')
  @ApiOperation({ summary: 'Wizard step 3 — WhatsApp number' })
  saveWhatsapp(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SaveWhatsappDto,
  ) {
    return this.integration.saveWhatsapp(principal.userId!, principal.teamId, body);
  }

  @Post('wizard/pixel')
  @ApiOperation({ summary: 'Wizard step 4 — auto-create TikTok Pixel' })
  createPixel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: CreatePixelDto,
  ) {
    return this.integration.createPixel(principal.userId!, principal.teamId, body);
  }

  @Post('wizard/optimization-event')
  @ApiOperation({ summary: 'Wizard step 5 — choose optimization event' })
  saveOptimizationEvent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SaveOptimizationEventDto,
  ) {
    return this.integration.saveOptimizationEvent(principal.userId!, principal.teamId, body);
  }

  @Get('wizard/advertiser-pixels')
  @ApiOperation({ summary: 'List existing TikTok pixels for selected advertiser' })
  advertiserPixels(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('integrationId') integrationId: string,
  ) {
    return this.integration.listAdvertiserPixels(
      principal.userId!,
      principal.teamId,
      integrationId,
    );
  }

  @Post('integrations/:id/refresh-pixel-status')
  @ApiOperation({ summary: 'Re-send activation events and refresh pixel status from TikTok' })
  refreshPixelStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
  ) {
    return this.integration.refreshPixelStatus(
      principal.userId!,
      principal.teamId,
      integrationId,
    );
  }

  @Post('integrations/:id/resync-ecommerce-events')
  @ApiOperation({ summary: 'Register CompletePayment/Lead on TikTok and re-fire recent store/form orders' })
  resyncEcommerceEvents(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
  ) {
    return this.integration.resyncEcommercePixel(
      principal.userId!,
      principal.teamId,
      integrationId,
    );
  }

  @Patch('integrations/:id')
  @ApiOperation({ summary: 'Update a TikTok pixel integration' })
  updateIntegration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.integration.updateIntegration(
      principal.userId!,
      principal.teamId,
      integrationId,
      body,
    );
  }

  @Delete('integrations/:id')
  @ApiOperation({ summary: 'Delete a TikTok pixel integration from Chatloora' })
  deleteIntegration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
  ) {
    return this.integration.deleteIntegration(
      principal.userId!,
      principal.teamId,
      integrationId,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'TikTok Pixel integration dashboard' })
  dashboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('days') days?: string,
    @Query('integrationId') integrationId?: string,
  ) {
    const parsed = days ? Number(days) : 30;
    return this.integration.getDashboard(
      principal.userId!,
      principal.teamId,
      Number.isFinite(parsed) ? parsed : 30,
      integrationId,
    );
  }

  @Get('debug/contacts')
  @ApiOperation({ summary: 'Debug Contact conversions (phone, ttclid, TikTok status)' })
  contactDebug(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('integrationId') integrationId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 100;
    return this.integration.getContactDebug(principal.userId!, principal.teamId, {
      integrationId,
      limit: Number.isFinite(parsed) ? parsed : 100,
    });
  }

  @Post('integrations/:id/events-api-credentials')
  @ApiOperation({ summary: 'Save Pixel ID + Events API Access Token (validated, encrypted)' })
  saveEventsApiCredentials(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
    @Body() body: SaveEventsApiCredentialsDto,
  ) {
    return this.eventsApi.saveCredentials(principal.userId!, principal.teamId, integrationId, body);
  }

  @Post('integrations/:id/test-connection')
  @ApiOperation({ summary: 'Test Pixel ID + Events API Access Token connection' })
  testConnection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') integrationId: string,
  ) {
    return this.eventsApi.testConnection(principal.userId!, principal.teamId, integrationId);
  }

  @Post('qualified-lead')
  @ApiOperation({ summary: 'Send Lead event after conversation is marked as Qualified Lead' })
  markQualified(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: MarkQualifiedLeadDto,
  ) {
    return this.lifecycle.sendLeadForConversation(principal.teamId, body.conversationId);
  }

  @Get('tracking-phones')
  @ApiOperation({ summary: 'List WhatsApp numbers linked for TikTok lead tracking only' })
  listTrackingPhones(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.trackingPhones.list(principal.teamId);
  }

  @Post('tracking-phones/connect')
  @ApiOperation({ summary: 'Start QR connect for a tracking-only WhatsApp number' })
  connectTrackingPhone(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { displayName?: string; integrationId?: string },
  ) {
    return this.trackingPhones.connect(principal.teamId, principal.userId!, body);
  }

  @Post('tracking-phones/link')
  @ApiOperation({ summary: 'Link an existing tracking WhatsApp number to a TikTok pixel' })
  linkTrackingPhone(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { channelId: string; integrationId: string },
  ) {
    return this.trackingPhones.linkToIntegration(principal.teamId, body.channelId, body.integrationId);
  }

  @Get('tracking-phones/qr')
  @ApiOperation({ summary: 'Get QR code for a tracking phone session' })
  trackingPhoneQr(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('sessionId') sessionId: string,
  ) {
    return this.trackingPhones.getQr(principal.teamId, sessionId);
  }

  @Get('tracking-phones/status')
  @ApiOperation({ summary: 'Get status for a tracking phone session' })
  trackingPhoneStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('sessionId') sessionId: string,
  ) {
    return this.trackingPhones.getStatus(principal.teamId, sessionId);
  }

  @Post('tracking-phones/disconnect')
  @ApiOperation({ summary: 'Disconnect a tracking phone session' })
  disconnectTrackingPhone(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { sessionId: string },
  ) {
    return this.trackingPhones.disconnect(principal.teamId, body.sessionId, principal.userId!);
  }

  @Delete('tracking-phones/session')
  @ApiOperation({ summary: 'Delete a tracking phone session' })
  deleteTrackingPhone(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { sessionId: string },
  ) {
    return this.trackingPhones.deleteSession(principal.teamId, body.sessionId, principal.userId!);
  }
}
