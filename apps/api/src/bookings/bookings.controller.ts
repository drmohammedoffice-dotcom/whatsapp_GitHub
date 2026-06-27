import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, Permission } from '@watsapp/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @RequirePermissions(Permission.INBOX_READ)
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('status') status?: BookingStatus,
    @Query('search') search?: string,
  ) {
    return this.bookings.list(principal.teamId, { status, search });
  }

  @Get('export/excel')
  @RequirePermissions(Permission.INBOX_READ)
  async exportExcel(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Res() res: Response) {
    const buffer = await this.bookings.exportExcel(principal.teamId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.xlsx"');
    res.send(buffer);
  }

  @Get('export/pdf')
  @RequirePermissions(Permission.INBOX_READ)
  async exportPdf(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Res() res: Response) {
    const buffer = await this.bookings.exportPdf(principal.teamId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.pdf"');
    res.send(buffer);
  }
}
