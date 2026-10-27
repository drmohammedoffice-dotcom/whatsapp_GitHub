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
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { UploadedMediaFile } from '../common/uploaded-media-file';
import { CurrentPartnerId } from './current-partner.decorator';
import { ApplyPartnerDto, ConfirmPayoutDto, PartnerChangePasswordDto, PartnerLoginDto } from './dto/sales-partners.dto';
import { PartnerJwtGuard } from './partner-jwt.guard';
import { SalesPartnersService } from './sales-partners.service';

@ApiTags('Sales Partners')
@Controller('sales-partners')
export class SalesPartnersPublicController {
  constructor(private readonly partners: SalesPartnersService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('apply')
  apply(@Body() dto: ApplyPartnerDto) {
    return this.partners.apply(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: PartnerLoginDto) {
    return this.partners.partnerLogin(dto);
  }
}

@ApiTags('Sales Partners Portal')
@UseGuards(PartnerJwtGuard)
@Controller('sales-partners/me')
export class SalesPartnersPortalController {
  constructor(private readonly partners: SalesPartnersService) {}

  @Get()
  me(@CurrentPartnerId() partnerId: string) {
    return this.partners.partnerMe(partnerId);
  }

  @Post('password')
  changePassword(@CurrentPartnerId() partnerId: string, @Body() dto: PartnerChangePasswordDto) {
    return this.partners.changePartnerPassword(partnerId, dto.currentPassword, dto.newPassword);
  }

  @Post('payouts')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  createPayout(
    @CurrentPartnerId() partnerId: string,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body()
    body: {
      amountCents?: string;
      accountNumber?: string;
      accountName?: string;
      method?: string;
      withdrawAll?: string;
    },
  ) {
    return this.partners.createPayoutDraft(
      partnerId,
      Number(body.amountCents ?? 0),
      body.accountNumber ?? '',
      file,
      body.withdrawAll === 'true' || body.withdrawAll === '1',
      { method: body.method, accountName: body.accountName },
    );
  }

  @Post('payouts/:id/confirm')
  confirmPayout(
    @CurrentPartnerId() partnerId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmPayoutDto,
  ) {
    return this.partners.confirmPayout(partnerId, id, dto.code);
  }

  @Post('payouts/:id/resend')
  resendPayout(@CurrentPartnerId() partnerId: string, @Param('id') id: string) {
    return this.partners.resendPayoutCode(partnerId, id);
  }

  @Post('payouts/:id/cancel')
  cancelPayout(@CurrentPartnerId() partnerId: string, @Param('id') id: string) {
    return this.partners.cancelPayoutDraft(partnerId, id);
  }

  @Get('payouts/:id/file/:kind')
  async payoutFile(
    @CurrentPartnerId() partnerId: string,
    @Param('id') id: string,
    @Param('kind') kind: 'account' | 'receipt',
  ) {
    const file = await this.partners.openPayoutFile(id, kind === 'receipt' ? 'receipt' : 'account', partnerId);
    return new StreamableFile(file.stream, { type: file.type });
  }
}
