import { Injectable, Logger } from '@nestjs/common';

import { TikTokConnectionStatus } from '@watsapp/database';

import { AuditService } from '../audit/audit.service';

import { PrismaService } from '../prisma/prisma.service';

import { TikTokLogService } from './tiktok-log.service';



@Injectable()

export class TikTokOAuthService {

  private readonly logger = new Logger(TikTokOAuthService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly audit: AuditService,

    private readonly logs: TikTokLogService,

  ) {}



  async disconnect(teamId: string, userId: string, reason?: string) {

    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId } });

    if (!account) return { ok: true };

    await this.prisma.tikTokToken.deleteMany({ where: { accountId: account.id } });

    await this.prisma.tikTokMarketingAdvertiser.deleteMany({ where: { userId } });
    await this.prisma.tikTokMarketingConnection.deleteMany({ where: { userId } });
    await this.prisma.tikTokLoginAdvertiser.deleteMany({ where: { userId } });
    await this.prisma.tikTokLoginAccount.deleteMany({ where: { userId } });

    await this.prisma.tikTokAccount.update({

      where: { id: account.id },

      data: {

        status: TikTokConnectionStatus.DISCONNECTED,

        businessName: null,

        openId: null,

        advertiserId: null,

        businessCenterId: null,

        connectedAt: null,

        lastSyncAt: null,

      },

    });

    await this.audit.log({

      teamId,

      actorUserId: userId,

      action: 'tiktok.disconnect',

      resource: 'tikTokAccount',

      resourceId: account.id,

      metadata: reason ? { reason } : undefined,

    });

    await this.logs.info(teamId, 'oauth.disconnect', reason ?? 'TikTok account disconnected');

    return { ok: true };

  }

}

