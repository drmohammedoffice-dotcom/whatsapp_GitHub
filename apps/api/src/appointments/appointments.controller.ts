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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { AppointmentProfileService } from './appointment-profile.service';
import { AppointmentsService } from './appointments.service';
import {
  AvailableSlotsQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentProfileDto,
  UpsertServiceDto,
  UpsertStaffDto,
} from './dto/appointment.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly profile: AppointmentProfileService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  dashboard(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.appointments.dashboard(principal.teamId);
  }

  @Get('profile')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.profile.get(principal.teamId);
  }

  @Post('profile')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateAppointmentProfileDto,
  ) {
    return this.profile.update(principal.teamId, dto);
  }

  @Post('staff')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  addStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertStaffDto) {
    return this.profile.addStaff(principal.teamId, dto);
  }

  @Patch('staff/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  updateStaff(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpsertStaffDto,
  ) {
    return this.profile.updateStaff(principal.teamId, id, dto);
  }

  @Delete('staff/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  removeStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.profile.removeStaff(principal.teamId, id);
  }

  @Post('services')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  addService(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertServiceDto) {
    return this.profile.addService(principal.teamId, dto);
  }

  @Patch('services/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  updateService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpsertServiceDto,
  ) {
    return this.profile.updateService(principal.teamId, id, dto);
  }

  @Delete('services/:id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  removeService(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.profile.removeService(principal.teamId, id);
  }

  @Get('slots')
  @RequirePermissions(Permission.APPOINTMENT_CALENDAR)
  slots(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: AvailableSlotsQueryDto) {
    return this.appointments.getAvailableSlots(principal.teamId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      durationMin: query.durationMin,
      serviceId: query.serviceId,
    });
  }

  @Get()
  @RequirePermissions(Permission.APPOINTMENT_READ)
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.appointments.list(principal.teamId, { status });
  }

  @Post()
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(principal.teamId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(principal.teamId, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.appointments.cancel(principal.teamId, id, body?.reason);
  }

  @Delete(':id')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.appointments.remove(principal.teamId, id);
  }
}
