import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole, SalesCommissionStatus, SalesPartnerStatus, SalesPayoutStatus } from '@watsapp/database';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../admin/decorators/require-admin-roles.decorator';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminRolesGuard } from '../admin/guards/admin-roles.guard';
import { AdminPrincipal } from '../admin/types/admin-principal';
import type { UploadedMediaFile } from '../common/uploaded-media-file';
import { SalesPartnersService } from './sales-partners.service';
import { AdminSetPasswordDto, RejectPartnerDto, UpdateCommissionRuleDto } from './dto/sales-partners.dto';

@ApiTags('Chatloora Admin Sales Partners')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.BILLING_MANAGER)
@Controller('admin/sales-partners')
export class AdminSalesPartnersController {
  constructor(private readonly partners: SalesPartnersService) {}

  @Get()
  list(@Query('status') status?: SalesPartnerStatus) {
    return this.partners.listApplications(status);
  }

  @Get('directory')
  directory(@Query('q') q?: string) {
    return this.partners.listDirectory(q);
  }

  @Get('wallet')
  wallet() {
    return this.partners.walletOverview();
  }

  @Get('rules')
  rules() {
    return this.partners.ensureRules();
  }

  @Patch('rules')
  saveRule(@Body() dto: UpdateCommissionRuleDto) {
    return this.partners.updateRule(dto);
  }

  @Get('commissions')
  commissions(@Query('status') status?: SalesCommissionStatus, @Query('partnerId') partnerId?: string) {
    return this.partners.listCommissions({ status, partnerId });
  }

  @Post('commissions/:id/status')
  setCommissionStatus(@Param('id') id: string, @Body() body: { status: SalesCommissionStatus }) {
    return this.partners.setCommissionStatus(id, body.status);
  }

  @Get('payouts')
  payouts(@Query('status') status?: SalesPayoutStatus) {
    return this.partners.listAllPayouts(status);
  }

  @Get('payouts/:id')
  payout(@Param('id') id: string) {
    return this.partners.getPayoutAdmin(id);
  }

  @Get('payouts/:id/file/:kind')
  async payoutFile(@Param('id') id: string, @Param('kind') kind: 'account' | 'receipt') {
    const file = await this.partners.openPayoutFile(id, kind === 'receipt' ? 'receipt' : 'account');
    return new StreamableFile(file.stream, { type: file.type });
  }

  @Post('payouts/:id/status')
  setPayoutStatus(@Param('id') id: string, @Body() body: { status: SalesPayoutStatus; note?: string }) {
    return this.partners.setPayoutStatus(id, body.status, body.note);
  }

  @Post('payouts/:id/pay')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  payPayout(@Param('id') id: string, @UploadedFile() file: UploadedMediaFile | undefined, @Body() body: { note?: string }) {
    return this.partners.markPayoutPaid(id, file, body?.note);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.partners.getPartnerAdmin(id);
  }

  @Post(':id/approve')
  approve(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.partners.approve(id, admin.adminUserId);
  }

  @Post(':id/reject')
  reject(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() dto: RejectPartnerDto) {
    return this.partners.reject(id, admin.adminUserId, dto.notes);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.partners.setStatus(id, SalesPartnerStatus.SUSPENDED);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.partners.resetPassword(id);
  }

  @Post(':id/password')
  setPassword(@Param('id') id: string, @Body() dto: AdminSetPasswordDto) {
    return this.partners.setPassword(id, dto.password);
  }

  @Patch(':id/email')
  updateEmail(@Param('id') id: string, @Body() body: { email?: string }) {
    return this.partners.updatePartnerEmail(id, body.email ?? '');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partners.deletePartner(id);
  }
}
