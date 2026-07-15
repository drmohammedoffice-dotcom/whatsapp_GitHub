import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { BillingService } from './billing.service';
import { CheckoutDto, ConfirmPaymentDto } from './dto/billing.dto';

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
    return this.billing.getStatus(principal.teamId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CheckoutDto) {
    return this.billing.checkout(principal.teamId, principal.userId!, dto.planSlug, dto.billingCycle);
  }

  @Get('payments/:paymentId')
  @UseGuards(JwtAuthGuard)
  getPayment(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('paymentId') paymentId: string) {
    return this.billing.getPayment(principal.teamId, paymentId);
  }

  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ConfirmPaymentDto) {
    return this.billing.confirmPayment(principal.teamId, dto.paymentId);
  }
}
