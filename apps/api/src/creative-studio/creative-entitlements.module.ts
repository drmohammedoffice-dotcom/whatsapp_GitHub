import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';

/**
 * Lightweight entitlements for Creative Studio (API + worker).
 * Avoids pulling Auth/JWT via BillingModule into the worker process.
 */
@Module({
  imports: [PrismaModule],
  providers: [PlanEntitlementsService],
  exports: [PlanEntitlementsService],
})
export class CreativeEntitlementsModule {}
