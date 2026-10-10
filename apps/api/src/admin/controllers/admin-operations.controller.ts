import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminNotificationChannel, AdminRole, BillingInterval, SubscriptionStatus, SupportTicketStatus } from '@watsapp/database';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminPrincipal } from '../types/admin-principal';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminSubscriptionsService } from '../services/admin-subscriptions.service';
import { AdminWorkspacesService } from '../services/admin-workspaces.service';
import { AdminIntegrationsService } from '../services/admin-integrations.service';
import { AdminSupportService } from '../services/admin-support.service';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { AdminOffersService } from '../services/admin-offers.service';

@ApiTags('Chatloora Admin Operations')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin')
export class AdminOperationsController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly subscriptions: AdminSubscriptionsService,
    private readonly workspaces: AdminWorkspacesService,
    private readonly integrations: AdminIntegrationsService,
    private readonly support: AdminSupportService,
    private readonly notifications: AdminNotificationsService,
    private readonly offers: AdminOffersService,
  ) {}

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  listUsers(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.users.list({
      q,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
      customersOnly: admin.role === AdminRole.STAFF,
    });
  }

  @Get('users/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  getUser(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post('users')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  createUser(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { email: string; name: string; password: string; teamName?: string },
  ) {
    return this.users.createUser(admin.adminUserId, body);
  }

  @Patch('users/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  updateUser(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: { email?: string; name?: string; password?: string },
  ) {
    return this.users.updateUser(admin.adminUserId, id, body);
  }

  @Post('users/:id/suspend')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  suspendUser(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.users.suspend(admin.adminUserId, id, body.reason);
  }

  @Post('users/:id/activate')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  activateUser(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.users.activate(admin.adminUserId, id);
  }

  @Delete('users/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  deleteUser(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.users.deleteUser(admin.adminUserId, id);
  }

  @Post('users/:id/reset-password')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  resetPassword(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: { password: string }) {
    return this.users.resetPassword(admin.adminUserId, id, body.password);
  }

  // ─── Subscriptions & billing ──────────────────────────────────────────────

  @Get('feature-definitions')
  listFeatureDefinitions() {
    return this.subscriptions.listFeatureDefinitions();
  }

  @Get('plans')
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Post('plans')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  createPlan(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.subscriptions.createPlan(admin.adminUserId, body as never);
  }

  @Patch('plans/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  updatePlan(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.subscriptions.updatePlan(admin.adminUserId, id, body);
  }

  @Delete('plans/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  deletePlan(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.subscriptions.deletePlan(admin.adminUserId, id);
  }

  // ─── Landing offers ───────────────────────────────────────────────────────

  @Get('offers')
  listOffers() {
    return this.offers.list();
  }

  @Post('offers')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  createOffer(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.offers.create(admin.adminUserId, body as never);
  }

  @Patch('offers/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  updateOffer(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.offers.update(admin.adminUserId, id, body);
  }

  @Delete('offers/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  deleteOffer(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.offers.delete(admin.adminUserId, id);
  }

  @Get('subscriptions')
  listSubscriptions(@Query('status') status?: SubscriptionStatus) {
    return this.subscriptions.listSubscriptions({ status });
  }

  @Post('subscriptions/activate')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  activateSubscription(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body()
    body: {
      teamId: string;
      planId: string;
      ownerUserId?: string;
      billingCycle?: BillingInterval;
      durationDays?: number;
    },
  ) {
    return this.subscriptions.activate(admin.adminUserId, body.teamId, body.planId, body.ownerUserId, {
      billingCycle: body.billingCycle,
      durationDays: body.durationDays,
    });
  }

  @Patch('subscriptions/:id/period')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  updateSubscriptionPeriod(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: { currentPeriodStart?: string; currentPeriodEnd?: string; extendDays?: number; reduceDays?: number; setDaysRemaining?: number; trialEndsAt?: string | null },
  ) {
    return this.subscriptions.updatePeriod(admin.adminUserId, id, body);
  }

  @Patch('subscriptions/:id/status')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  updateSubscriptionStatus(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: { status: SubscriptionStatus },
  ) {
    return this.subscriptions.updateStatus(admin.adminUserId, id, body.status);
  }

  @Delete('subscriptions/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  deleteSubscription(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.subscriptions.deleteSubscription(admin.adminUserId, id);
  }

  @Post('subscriptions/:id/pause')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  pauseSubscription(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.subscriptions.pause(admin.adminUserId, id);
  }

  @Post('subscriptions/:id/cancel')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  cancelSubscription(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.subscriptions.cancel(admin.adminUserId, id);
  }

  @Post('subscriptions/:id/change-plan')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.STAFF)
  changePlan(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: { planId: string }) {
    return this.subscriptions.changePlan(admin.adminUserId, id, body.planId);
  }

  @Get('payments')
  listPayments(@Query('teamId') teamId?: string) {
    return this.subscriptions.listPayments(teamId);
  }

  @Get('invoices')
  listInvoices(@Query('teamId') teamId?: string) {
    return this.subscriptions.listInvoices(teamId);
  }

  @Post('payments/manual')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  manualPayment(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.subscriptions.manualPayment(admin.adminUserId, body as never);
  }

  // ─── Workspaces ───────────────────────────────────────────────────────────

  @Get('workspaces')
  listWorkspaces(@Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.workspaces.list({ q, skip: skip ? Number(skip) : 0, take: take ? Number(take) : 50 });
  }

  @Get('workspaces/:id')
  getWorkspace(@Param('id') id: string) {
    return this.workspaces.getById(id);
  }

  @Post('workspaces')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  createWorkspace(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { name: string; slug: string; ownerUserId: string },
  ) {
    return this.workspaces.create(admin.adminUserId, body.name, body.slug, body.ownerUserId);
  }

  @Post('workspaces/:id/disable')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  disableWorkspace(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.workspaces.disable(admin.adminUserId, id);
  }

  @Delete('workspaces/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  deleteWorkspace(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.workspaces.deleteWorkspace(admin.adminUserId, id);
  }

  // ─── Integrations ─────────────────────────────────────────────────────────

  @Get('whatsapp')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  listWhatsApp() {
    return this.integrations.listWhatsApp();
  }

  @Post('whatsapp/:type/:id/disconnect')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER)
  disconnectWhatsApp(@Param('type') type: 'session' | 'cloud', @Param('id') id: string) {
    return this.integrations.disconnectWhatsApp(id, type);
  }

  @Get('tiktok')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  listTikTok() {
    return this.integrations.listTikTok();
  }

  @Get('meta')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.DEVELOPER, AdminRole.SUPPORT_AGENT)
  listMeta() {
    return this.integrations.listMeta();
  }

  // ─── Support ──────────────────────────────────────────────────────────────

  @Get('support/tickets')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  listTickets(@Query('status') status?: SupportTicketStatus) {
    return this.support.list({ status });
  }

  @Get('support/tickets/:id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  getTicket(@Param('id') id: string) {
    return this.support.getById(id);
  }

  @Post('support/tickets')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  createTicket(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.support.create(admin.adminUserId, body as never);
  }

  @Post('support/tickets/:id/assign')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  assignTicket(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: { assigneeId: string }) {
    return this.support.assign(admin.adminUserId, id, body.assigneeId);
  }

  @Post('support/tickets/:id/reply')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  replyTicket(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: { body: string; isInternal?: boolean },
  ) {
    return this.support.reply(admin.adminUserId, id, body.body, body.isInternal ?? false);
  }

  @Patch('support/tickets/:id/status')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  ticketStatus(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() body: { status: SupportTicketStatus },
  ) {
    return this.support.updateStatus(admin.adminUserId, id, body.status);
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  @Get('notifications')
  listNotifications(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.notifications.list({ skip: skip ? Number(skip) : 0, take: take ? Number(take) : 50 });
  }

  @Post('notifications/send')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT)
  sendNotification(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.notifications.sendToUser(admin.adminUserId, body as never);
  }

  @Post('notifications/broadcast')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  broadcast(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Record<string, unknown>) {
    return this.notifications.broadcast(admin.adminUserId, body as never);
  }

  @Get('notifications/program')
  noticeProgram() {
    return this.notifications.getProgram();
  }

  @Post('notifications/program')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  saveNoticeProgram(@CurrentAdmin() admin: AdminPrincipal, @Body() body: { templates?: Array<{ kind: string; title: string; body: string; enabled: boolean; daysBefore: number }> }) {
    return this.notifications.saveProgram(admin.adminUserId, body.templates ?? []);
  }

  @Post('notifications/program/send')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
  sendNoticeProgram(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { kind?: string; audience?: string; title?: string; body?: string },
  ) {
    return this.notifications.sendProgram(admin.adminUserId, body);
  }

  @Post('notifications/expert')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER, AdminRole.SUPPORT_AGENT)
  noticeExpert(@Body() body: { brief?: string; kind?: string }) {
    return this.notifications.marketingExpert(body.brief ?? '', body.kind);
  }
}
