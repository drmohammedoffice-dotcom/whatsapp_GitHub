import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentSource, Permission } from '@watsapp/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { AppointmentsService } from '../../appointments/appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../../appointments/dto/appointment.dto';
import { CalendarService } from './calendar.service';
import { GoogleCalendarOAuthService } from './google-calendar-oauth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

/** Alias routes at /api/v1/integrations/google/* */
@ApiTags('Google Calendar')
@Controller('integrations/google')
export class GoogleIntegrationsController {
  constructor(
    private readonly oauth: GoogleCalendarOAuthService,
    private readonly sync: GoogleCalendarSyncService,
  ) {}

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.status(principal.teamId);
  }

  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  connectGet(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.startConnect(principal.teamId, principal.userId ?? 'system');
  }

  @Post('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  connectPost(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
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
  syncNow(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.sync.syncCalendar(principal.teamId);
  }

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

/** Calendar ops at /api/v1/calendar/* */
@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('calendar')
export class CalendarApiController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly appointments: AppointmentsService,
  ) {}

  @Get('events')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  events(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.calendar.listUpcomingAppointments(principal.teamId);
  }

  @Get('available-slots')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  availableSlots(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('durationMin') durationMin?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.appointments.getAvailableSlots(principal.teamId, {
      from: from ? new Date(from) : new Date(),
      to: to ? new Date(to) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMin: durationMin ? Number(durationMin) : undefined,
      serviceId,
    });
  }

  @Post('create')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(principal.teamId, dto, AppointmentSource.HUMAN);
  }

  @Put('update/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(principal.teamId, id, dto);
  }

  @Put('update')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  updateBody(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateAppointmentDto & { id: string },
  ) {
    return this.appointments.update(principal.teamId, dto.id, dto);
  }

  @Delete('delete/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.appointments.remove(principal.teamId, id);
  }

  @Delete('delete')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  removeBody(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: { id: string }) {
    return this.appointments.remove(principal.teamId, body.id);
  }
}
