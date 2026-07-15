import { Injectable, Logger } from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { SubscriptionStatus } from '@watsapp/database';

import { PrismaService } from '../prisma/prisma.service';

import { BillingAccessService } from './billing-access.service';



@Injectable()

export class SubscriptionExpiryService {

  private readonly logger = new Logger(SubscriptionExpiryService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly access: BillingAccessService,

  ) {}



  @Cron(CronExpression.EVERY_HOUR)

  async expireSubscriptions() {

    const now = new Date();

    const candidates = await this.prisma.subscription.findMany({

      where: {

        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },

        OR: [

          { currentPeriodEnd: { lt: now } },

          { status: SubscriptionStatus.TRIAL, trialEndsAt: { lt: now } },

        ],

      },

      select: { id: true, teamId: true },

    });



    for (const sub of candidates) {

      await this.prisma.subscription.update({

        where: { id: sub.id },

        data: {

          status: SubscriptionStatus.EXPIRED,

          expiredAt: now,

        },

      });

      await this.access.suspendTeamIntegrations(sub.teamId);

      this.logger.log(`Subscription expired team=${sub.teamId}`);

    }

  }

}

