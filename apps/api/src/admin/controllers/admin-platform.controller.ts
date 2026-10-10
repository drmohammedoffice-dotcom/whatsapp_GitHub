import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@watsapp/database';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminAiGatewayService } from '../services/admin-ai-gateway.service';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AdminAssistantService } from '../services/admin-assistant.service';
import { AdminSettingsService } from '../services/admin-settings.service';
import { AdminVoiceService } from '../services/admin-voice.service';
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
    private readonly assistant: AdminAssistantService,
    private readonly voice: AdminVoiceService,
    private readonly aiGateway: AdminAiGatewayService,
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

  @Get('ai-gateway')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'AI Gateway HA status and per-key metrics (no secrets)' })
  aiGatewayStatus() {
    return this.aiGateway.getStatus();
  }

  @Post('ai-gateway/probe')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  @ApiOperation({ summary: 'Run an immediate AI Gateway health probe' })
  aiGatewayProbe() {
    return this.aiGateway.probeNow();
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

  @Get('assistant/settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  assistantSettings() {
    return this.assistant.getSettings();
  }

  @Patch('assistant/settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  updateAssistantSettings(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.assistant.updateSettings(admin.adminUserId, body as never);
  }

  @Get('assistant/articles')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  assistantArticles() {
    return this.assistant.listArticles();
  }

  @Post('assistant/articles')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  createAssistantArticle(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.assistant.createArticle(admin.adminUserId, body as never);
  }

  @Patch('assistant/articles/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  updateAssistantArticle(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.assistant.updateArticle(admin.adminUserId, id, body);
  }

  @Delete('assistant/articles/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  deleteAssistantArticle(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.assistant.deleteArticle(admin.adminUserId, id);
  }

  @Get('assistant/stats')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  assistantStats() {
    return this.assistant.stats();
  }

  @Get('voice-ai/settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  voiceSettings() {
    return this.voice.getSettings();
  }

  @Patch('voice-ai/settings')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  updateVoiceSettings(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.voice.updateSettings(admin.adminUserId, body);
  }

  @Get('voice-ai/agent')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  voiceAgent() {
    return this.voice.platformAgent();
  }

  @Patch('voice-ai/agent')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  updateVoiceAgent(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.voice.updatePlatformAgent(admin.adminUserId, body);
  }

  @Get('voice-ai/numbers')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  voiceNumbers() {
    return this.voice.listNumbers();
  }

  @Post('voice-ai/numbers')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  addVoiceNumber(@CurrentAdmin() admin: AdminPrincipal, @Body() body: { e164: string; teamId?: string }) {
    return this.voice.addNumber(admin.adminUserId, body.e164, body.teamId);
  }

  @Get('voice-ai/stats')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  voiceStats() {
    return this.voice.stats();
  }

  @Get('voice-ai/calls')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  voiceCalls() {
    return this.voice.listCalls();
  }

  @Get('voice-ai/calls/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  voiceCall(@Param('id') id: string) {
    return this.voice.getCall(id);
  }

  @Get('voice-ai/in-app-sessions')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  inAppVoiceSessions() {
    return this.voice.listInAppSessions();
  }
}
