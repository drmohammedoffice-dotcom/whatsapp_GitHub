import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { IntegrationsHubService } from './integrations-hub.service';

type IntegrationActionBody = {
  channelId?: string;
  sessionId?: string;
  accountId?: string;
  cloudAccountId?: string;
  connectionId?: string;
};

@ApiTags('Integrations Hub')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations')
export class IntegrationsHubController {
  constructor(private readonly hub: IntegrationsHubService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Unified integrations hub — all providers and connection health' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.hub.list(principal.teamId, principal.userId!);
  }

  @Get(':provider/status')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Integration provider status snapshot' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('provider') provider: string) {
    return this.hub.getStatus(principal.teamId, principal.userId!, provider);
  }

  @Get(':provider')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Single integration provider detail' })
  getProvider(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('provider') provider: string) {
    return this.hub.getProvider(principal.teamId, principal.userId!, provider);
  }

  @Post(':provider/connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Start provider connection (OAuth redirect, QR, or inline flow)' })
  connect(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('provider') provider: string,
    @Body() body: IntegrationActionBody,
  ) {
    return this.hub.connect(principal.teamId, principal.userId!, provider, body);
  }

  @Post(':provider/disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Disconnect provider account or channel' })
  disconnect(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('provider') provider: string,
    @Body() body: IntegrationActionBody,
  ) {
    return this.hub.disconnect(principal.teamId, principal.userId!, provider, body);
  }

  @Post(':provider/reconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Reconnect expired provider session' })
  reconnect(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('provider') provider: string,
    @Body() body: IntegrationActionBody,
  ) {
    return this.hub.reconnect(principal.teamId, principal.userId!, provider, body);
  }

  @Post(':provider/sync')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Sync provider data (Google Calendar two-way sync)' })
  sync(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('provider') provider: string) {
    return this.hub.sync(principal.teamId, principal.userId!, provider);
  }
}
