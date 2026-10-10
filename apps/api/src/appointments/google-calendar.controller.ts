import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { CalendarService } from '../integrations/google-calendar/calendar.service';
import { GoogleCalendarOAuthService } from '../integrations/google-calendar/google-calendar-oauth.service';
import { GoogleCalendarSyncService } from '../integrations/google-calendar/google-calendar-sync.service';
import { UpdateCalendarIdDto } from './dto/appointment.dto';

@ApiTags('Google Calendar')
@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly calendar: CalendarService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.status(principal.teamId);
  }

  @Post('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.startConnect(principal.teamId, principal.userId ?? 'system');
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.disconnect(principal.teamId, principal.userId ?? 'system');
  }

  @Post('reconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.reconnect(principal.teamId, principal.userId ?? 'system');
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  sync(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.syncService.syncCalendar(principal.teamId);
  }

  @Post('calendar-id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  setCalendarId(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateCalendarIdDto,
  ) {
    return this.oauth.updateCalendarId(principal.teamId, dto.calendarId);
  }

  @Get('upcoming')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  upcoming(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.calendar.listUpcomingAppointments(principal.teamId);
  }

  /** Public OAuth callback — no JWT. */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.oauth.handleCallback(code, state);
    return res.redirect(result.redirectUrl);
  }
}
