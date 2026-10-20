import { All, Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { BillingService, sanitizePaymentId } from './billing.service';
import { CheckoutDto, ConfirmPaymentDto, AutoRenewDto } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.billing.getStatusForUser(principal.userId, principal.teamId);
  }

  @All('wayl-return/:paymentId')
  async waylReturn(@Param('paymentId') paymentId: string, @Res() res: Response) {
    const id = sanitizePaymentId(paymentId);
    try {
      await this.billing.completeWaylReturn(id);
    } catch {
      /* still send the user back to the receipt page */
    }
    return res.redirect(303, await this.billing.publicReturnUrl(id));
  }

  @Post('payments/:paymentId')
  async waylPaymentPost(@Param('paymentId') paymentId: string, @Res() res: Response) {
    const id = sanitizePaymentId(paymentId);
    try {
      await this.billing.completeWaylReturn(id);
    } catch {
      /* ignore */
    }
    return res.redirect(303, await this.billing.publicReturnUrl(id));
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CheckoutDto) {
    return this.billing.checkout(principal.teamId, principal.userId!, dto.planSlug, dto.billingCycle, {
      code: dto.referralCode,
      source: dto.referralSource,
    });
  }

  @Get('payments/:paymentId')
  @UseGuards(JwtAuthGuard)
  getPayment(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('paymentId') paymentId: string) {
    return this.billing.getPayment(principal.teamId, paymentId, principal.userId);
  }

  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ConfirmPaymentDto) {
    return this.billing.confirmPayment(principal.teamId, dto.paymentId);
  }

  @Post('payments/:paymentId/sync')
  @UseGuards(JwtAuthGuard)
  syncPayment(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('paymentId') paymentId: string) {
    return this.billing.syncWaylPayment(principal.teamId, paymentId, principal.userId);
  }

  @Post('auto-renew')
  @UseGuards(JwtAuthGuard)
  setAutoRenew(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: AutoRenewDto) {
    return this.billing.setAutoRenew(principal.teamId, dto.enabled);
  }
}
