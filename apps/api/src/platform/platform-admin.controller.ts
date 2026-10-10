import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { WebhookEventService } from './webhooks/webhook-event.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly webhooks: WebhookEventService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('webhook-events')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  webhookEvents(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.webhooks.list(p.teamId);
  }

  @Get('redirect-logs')
  @RequirePermissions(Permission.CAMPAIGN_MANAGE)
  redirectLogs(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.prisma.redirectLog.findMany({
      where: { teamId: p.teamId },
      include: { campaign: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
