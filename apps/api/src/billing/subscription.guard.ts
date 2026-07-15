import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { BillingAccessService } from './billing-access.service';
import type { RequestWithPrincipal } from '../common/principal';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly access: BillingAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const teamId = request.principal?.teamId;
    if (!teamId) throw new ForbiddenException('Subscription required');

    const { allowed } = await this.access.assertTeamAccess(teamId);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Subscription expired or inactive',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    return true;
  }
}
