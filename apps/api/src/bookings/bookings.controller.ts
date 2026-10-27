import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, Permission } from '@watsapp/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { BookingsService } from './bookings.service';
import { UpdateBookingDto } from './dto/booking.dto';

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

  @Get('export/meta')
  @RequirePermissions(Permission.INBOX_READ)
  exportMeta(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.bookings.getExportMeta(principal.teamId);
  }

  @Get('export/excel')
  @RequirePermissions(Permission.INBOX_READ)
  async exportExcel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mark') mark?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.bookings.exportExcel(principal.teamId, this.parseRange(from, to), mark !== '0');
    res!.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res!.setHeader('Content-Disposition', 'attachment; filename="orders.xlsx"');
    res!.send(buffer);
  }

  @Get('export/pdf')
  @RequirePermissions(Permission.INBOX_READ)
  async exportPdf(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mark') mark?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.bookings.exportPdf(principal.teamId, this.parseRange(from, to), mark !== '0');
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader('Content-Disposition', 'attachment; filename="orders.pdf"');
    res!.send(buffer);
  }

  /** Called after the exported file was saved, when the export was fetched with mark=0. */
  @Post('export/mark')
  @RequirePermissions(Permission.INBOX_READ)
  markExported(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: { from?: number; to?: number }) {
    return this.bookings.markExportedRange(principal.teamId, this.parseRange(body?.from != null ? String(body.from) : undefined, body?.to != null ? String(body.to) : undefined));
  }

  @Patch(':id')
  @RequirePermissions(Permission.INBOX_WRITE)
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.update(principal.teamId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INBOX_WRITE)
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.bookings.remove(principal.teamId, id);
  }

  private parseRange(from?: string, to?: string) {
    const fromSeq = from ? Number(from) : undefined;
    const toSeq = to ? Number(to) : undefined;
    return {
      fromSeq: Number.isFinite(fromSeq) && fromSeq! > 0 ? Math.floor(fromSeq!) : undefined,
      toSeq: Number.isFinite(toSeq) && toSeq! > 0 ? Math.floor(toSeq!) : undefined,
    };
  }
}
