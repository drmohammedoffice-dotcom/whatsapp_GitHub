import { IsEnum, IsString } from 'class-validator';
import { BillingInterval } from '@watsapp/database';

export const PLAN_SLUGS = ['basic', 'professional', 'business'] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export class CheckoutDto {
  @IsString()
  planSlug!: string;

  @IsEnum(BillingInterval)
  billingCycle!: BillingInterval;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentId!: string;
}
