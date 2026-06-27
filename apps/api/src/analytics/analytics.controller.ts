import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @RequirePermissions(Permission.ANALYTICS_READ)
  summary(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.summary(principal.teamId); }

  @Get('response-time')
  @RequirePermissions(Permission.ANALYTICS_READ)
  response(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.responseTime(principal.teamId); }

  @Get('volume')
  @RequirePermissions(Permission.ANALYTICS_READ)
  volume(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.volume(principal.teamId); }

  @Get('agents')
  @RequirePermissions(Permission.ANALYTICS_READ)
  agents(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.agentPerformance(principal.teamId); }

  @Get('ai')
  @RequirePermissions(Permission.ANALYTICS_READ)
  ai(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.aiMetrics(principal.teamId); }

  @Get('products')
  @RequirePermissions(Permission.ANALYTICS_READ)
  products(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.topProducts(principal.teamId); }

  @Get('leads')
  @RequirePermissions(Permission.ANALYTICS_READ)
  leads(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.leadStats(principal.teamId); }

  @Get('conversations')
  @RequirePermissions(Permission.ANALYTICS_READ)
  conversations(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.analytics.conversationAnalytics(principal.teamId); }
}
