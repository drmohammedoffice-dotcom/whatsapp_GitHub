import { Injectable } from '@nestjs/common';
import { LandingPageService, type LandingVisibility } from '../../landing/landing-page.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminLandingService {
  constructor(
    private readonly landing: LandingPageService,
    private readonly audit: AdminAuditService,
  ) {}

  get() {
    return this.landing.getAdmin();
  }

  async save(
    adminUserId: string,
    input: { contentEn?: unknown; contentAr?: unknown; visibility?: LandingVisibility },
  ) {
    const result = await this.landing.save(adminUserId, input);
    await this.audit.log({
      adminUserId,
      action: 'landing.update',
      resource: 'landing_page_config',
      resourceId: 'default',
    });
    return result;
  }

  async reset(adminUserId: string) {
    const result = await this.landing.reset(adminUserId);
    await this.audit.log({
      adminUserId,
      action: 'landing.reset',
      resource: 'landing_page_config',
      resourceId: 'default',
    });
    return result;
  }
}
