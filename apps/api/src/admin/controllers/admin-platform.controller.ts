import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@watsapp/database';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AdminSettingsService } from '../services/admin-settings.service';
import { AdminLandingService } from '../services/admin-landing.service';
import { AdminPrincipal } from '../types/admin-principal';

@ApiTags('Chatloora Admin Platform')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin')
export class AdminPlatformController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly analytics: AdminAnalyticsService,
    private readonly audit: AdminAuditService,
    private readonly settings: AdminSettingsService,
    private readonly landing: AdminLandingService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard KPIs' })
  getDashboard() {
    return this.dashboard.getStats();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'MRR, churn, growth analytics' })
  getAnalytics() {
    return this.analytics.overview();
  }

  @Get('audit-logs')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'Platform audit logs' })
  auditLogs(@Query('action') action?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.audit.list({ action, skip: skip ? Number(skip) : 0, take: take ? Number(take) : 50 });
  }

  @Get('settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'System settings' })
  listSettings(@Query('category') category?: string) {
    return this.settings.list(category);
  }

  @Patch('settings/:key')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'Update system setting' })
  updateSetting(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('key') key: string,
    @Body() body: { value: unknown; category?: string },
  ) {
    return this.settings.upsert(admin.adminUserId, key, body.value as never, body.category);
  }

  @Get('settings/maintenance')
  @ApiOperation({ summary: 'Maintenance mode status' })
  maintenance() {
    return this.settings.getMaintenanceMode();
  }

  @Get('landing')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Landing page CMS content' })
  getLanding() {
    return this.landing.get();
  }

  @Put('landing')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'Save landing page CMS content' })
  saveLanding(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { contentEn?: unknown; contentAr?: unknown; visibility?: Record<string, boolean> },
  ) {
    return this.landing.save(admin.adminUserId, body);
  }

  @Post('landing/reset')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'Reset landing page CMS to built-in defaults' })
  resetLanding(@CurrentAdmin() admin: AdminPrincipal) {
    return this.landing.reset(admin.adminUserId);
  }

}
