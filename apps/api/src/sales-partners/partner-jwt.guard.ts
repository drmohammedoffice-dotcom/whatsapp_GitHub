import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SalesPartnersService } from './sales-partners.service';

@Injectable()
export class PartnerJwtGuard implements CanActivate {
  constructor(private readonly partners: SalesPartnersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      partner?: { id: string };
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Partner authentication required');
    const partner = await this.partners.resolvePartnerFromToken(header.slice(7));
    request.partner = { id: partner.id };
    return true;
  }
}
