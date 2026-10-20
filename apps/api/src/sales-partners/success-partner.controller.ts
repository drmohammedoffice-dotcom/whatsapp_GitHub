import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UploadedMediaFile } from '../common/uploaded-media-file';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { SalesPartnersService } from './sales-partners.service';

@ApiTags('Success Partner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('success-partner')
export class SuccessPartnerController {
  constructor(private readonly partners: SalesPartnersService) {}

  @Get()
  state(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.partners.successPartnerState(principal.userId!);
  }

  @Post('start')
  start(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { name?: string; age?: number; city?: string; phone?: string; email?: string; password?: string; passwordConfirm?: string },
  ) {
    return this.partners.startSuccessPartner(principal.userId!, {
      name: body.name ?? '',
      age: Number(body.age ?? 0),
      city: body.city ?? '',
      phone: body.phone ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
      passwordConfirm: body.passwordConfirm ?? '',
    });
  }

  @Post('ticket')
  ticket(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { email?: string; subject?: string; message?: string },
  ) {
    return this.partners.createSuccessTicket(principal.userId!, principal.teamId, {
      email: body.email ?? '',
      subject: body.subject ?? '',
      message: body.message ?? '',
    });
  }

  @Post('confirm')
  confirm(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: { code?: string }) {
    return this.partners.confirmSuccessPartner(principal.userId!, body.code ?? '');
  }

  @Post('resend')
  resend(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.partners.resendSuccessCode(principal.userId!);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  avatar(@CurrentPrincipal() principal: AuthenticatedPrincipal, @UploadedFile() file?: UploadedMediaFile) {
    return this.partners.saveSuccessAvatar(principal.userId!, file);
  }

  @Get('avatar')
  async avatarFile(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    const file = await this.partners.openSuccessAvatar(principal.userId!);
    return new StreamableFile(file.stream, { type: file.type });
  }

  @Get('payouts/:id/receipt')
  async receipt(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    const file = await this.partners.openSuccessReceipt(principal.userId!, id);
    return new StreamableFile(file.stream, { type: file.type });
  }

  @Post('payouts')
  payout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: { amountCents?: number; method?: 'ZAIN_CASH' | 'MASTERCARD'; accountNumber?: string; accountName?: string },
  ) {
    return this.partners.createSuccessPayout(principal.userId!, {
      amountCents: Number(body.amountCents ?? 0),
      method: body.method === 'MASTERCARD' ? 'MASTERCARD' : 'ZAIN_CASH',
      accountNumber: body.accountNumber ?? '',
      accountName: body.accountName,
    });
  }

  @Post('payouts/:id/confirm')
  confirmPayout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: { code?: string },
  ) {
    return this.partners.confirmSuccessPayout(principal.userId!, id, body.code ?? '');
  }

  @Post('payouts/:id/resend')
  resendPayout(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.partners.resendSuccessPayoutCode(principal.userId!, id);
  }

  @Post('payouts/:id/cancel')
  cancelPayout(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.partners.cancelSuccessPayoutDraft(principal.userId!, id);
  }
}
