import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingInterval,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingAccessService } from '../../billing/billing-access.service';
import { FEATURE_REGISTRY, entitlementsFromLimits, seedLimitsForSlug, type StoredEntitlement } from '../../billing/feature-registry';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { SalesPartnersService } from '../../sales-partners/sales-partners.service';
import { AdminAuditService } from './admin-audit.service';

const MONTHLY_DAYS = 30;
const YEARLY_DAYS = 365;

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly billingAccess: BillingAccessService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly salesPartners: SalesPartnersService,
  ) {}

  listFeatureDefinitions() {
    return this.entitlements.listFeatureDefinitions();
  }

  async listPlans() {
    await this.entitlements.syncFeatureCatalog();
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { entitlements: true },
    });
    const result = [];
    for (const plan of plans) {
      if (plan.entitlements.length === 0) {
        await this.entitlements.ensurePlanEntitlements(plan.id, plan.slug);
      }
      const limits = await this.entitlements.getPlanLimits(plan.id, plan.slug);
      const rows = await this.prisma.planEntitlement.findMany({ where: { planId: plan.id } });
      result.push({
        ...plan,
        limits,
        entitlements: FEATURE_REGISTRY.map((feature) => {
          const row = rows.find((item) => item.featureKey === feature.key);
          return {
            ...feature,
            enabled: row?.enabled ?? false,
            limitValue: row?.limitValue ?? null,
          };
        }),
      });
    }
    return result;
  }

  async createPlan(adminUserId: string, input: {
    slug: string;
    name?: string;
    nameAr?: string;
    nameEn?: string;
    description?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    priceCents: number;
    yearlyPriceCents?: number;
    currency?: string;
    interval?: BillingInterval;
    trialDays?: number;
    sortOrder?: number;
    isActive?: boolean;
    isRecommended?: boolean;
    accentColor?: string;
    features?: unknown;
    entitlements?: unknown;
  }) {
    const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) throw new BadRequestException('Slug is required');
    const nameEn = (input.nameEn ?? input.name ?? slug).trim();
    const nameAr = (input.nameAr ?? input.name ?? nameEn).trim();
    if (!nameEn || !nameAr) throw new BadRequestException('Plan names are required');
    const yearlyPriceCents =
      input.yearlyPriceCents ?? Math.round(input.priceCents * 12 * 0.8);
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        slug,
        name: nameEn,
        nameAr,
        nameEn,
        description: input.descriptionEn ?? input.description,
        descriptionAr: input.descriptionAr ?? input.description ?? null,
        descriptionEn: input.descriptionEn ?? input.description ?? null,
        priceCents: input.priceCents,
        yearlyPriceCents,
        currency: input.currency ?? 'USD',
        interval: input.interval ?? BillingInterval.MONTHLY,
        trialDays: input.trialDays ?? 14,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        isRecommended: input.isRecommended ?? false,
        accentColor: input.accentColor,
        features: input.features as never,
      },
    });
    const rows = this.parseEntitlements(input.entitlements, slug);
    await this.entitlements.replacePlanEntitlements(plan.id, rows);
    await this.audit.log({
      adminUserId,
      action: 'plan.create',
      resource: 'subscription_plan',
      resourceId: plan.id,
      metadata: { slug, entitlements: rows },
    });
    return this.getPlan(plan.id);
  }

  async updatePlan(adminUserId: string, id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    const entitlementsInput = data.entitlements;
    const patch: Record<string, unknown> = {};
    if (typeof data.nameEn === 'string' && data.nameEn.trim()) {
      patch.nameEn = data.nameEn.trim();
      patch.name = data.nameEn.trim();
    } else if (typeof data.name === 'string' && data.name.trim()) {
      patch.name = data.name.trim();
    }
    if (typeof data.nameAr === 'string') patch.nameAr = data.nameAr;
    if (typeof data.descriptionAr === 'string') patch.descriptionAr = data.descriptionAr;
    if (typeof data.descriptionEn === 'string') {
      patch.descriptionEn = data.descriptionEn;
      patch.description = data.descriptionEn;
    } else if (typeof data.description === 'string') patch.description = data.description;
    if (typeof data.priceCents === 'number') patch.priceCents = data.priceCents;
    if (typeof data.yearlyPriceCents === 'number') patch.yearlyPriceCents = data.yearlyPriceCents;
    if (typeof data.currency === 'string') patch.currency = data.currency;
    if (typeof data.trialDays === 'number') patch.trialDays = data.trialDays;
    if (typeof data.sortOrder === 'number') patch.sortOrder = data.sortOrder;
    if (typeof data.isActive === 'boolean') patch.isActive = data.isActive;
    if (typeof data.isRecommended === 'boolean') patch.isRecommended = data.isRecommended;
    if (typeof data.accentColor === 'string' || data.accentColor === null) patch.accentColor = data.accentColor;
    if (data.features !== undefined) patch.features = data.features;

    const updated = Object.keys(patch).length
      ? await this.prisma.subscriptionPlan.update({
          where: { id },
          data: patch as never,
        })
      : existing;
    if (entitlementsInput !== undefined) {
      const rows = this.parseEntitlements(entitlementsInput, updated.slug);
      await this.entitlements.replacePlanEntitlements(id, rows);
      await this.audit.log({
        adminUserId,
        action: 'plan.entitlements.update',
        resource: 'subscription_plan',
        resourceId: id,
        metadata: { entitlements: rows, priceCents: updated.priceCents },
      });
    } else {
      await this.entitlements.invalidatePlan(id);
      await this.audit.log({ adminUserId, action: 'plan.update', resource: 'subscription_plan', resourceId: id });
    }
    return this.getPlan(id);
  }

  async deletePlan(adminUserId: string, id: string) {
    await this.entitlements.invalidatePlan(id);
    return this.prisma.subscriptionPlan.delete({ where: { id } }).then(async (plan) => {
      await this.audit.log({ adminUserId, action: 'plan.delete', resource: 'subscription_plan', resourceId: id });
      return plan;
    });
  }

  private async getPlan(id: string) {
    const plans = await this.listPlans();
    return plans.find((plan) => plan.id === id);
  }

  private parseEntitlements(input: unknown, slug: string): StoredEntitlement[] {
    const fallback = entitlementsFromLimits(seedLimitsForSlug(slug));
    if (!Array.isArray(input)) return fallback;
    const known = new Map(FEATURE_REGISTRY.map((f) => [f.key, f]));
    const rows: StoredEntitlement[] = [];
    for (const raw of input) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as {
        featureKey?: string;
        key?: string;
        enabled?: boolean;
        limitValue?: number | null;
        mode?: string;
      };
      const featureKey = item.featureKey ?? item.key;
      const meta = featureKey ? known.get(featureKey) : undefined;
      if (!meta) continue;
      if (meta.valueType === 'BOOLEAN') {
        rows.push({ featureKey: meta.key, enabled: Boolean(item.enabled), limitValue: null });
        continue;
      }
      if (item.mode === 'unlimited' || item.limitValue === -1) {
        rows.push({ featureKey: meta.key, enabled: true, limitValue: -1 });
        continue;
      }
      if (item.mode === 'disabled' || item.enabled === false) {
        rows.push({ featureKey: meta.key, enabled: false, limitValue: 0 });
        continue;
      }
      const limit = Number(item.limitValue ?? 0);
      if (!Number.isFinite(limit) || limit < -1) {
        throw new BadRequestException(`${meta.key} cannot be negative`);
      }
      const normalized = Math.floor(limit);
      rows.push({
        featureKey: meta.key,
        enabled: normalized !== 0,
        limitValue: normalized,
      });
    }
    const seen = new Set(rows.map((row) => row.featureKey));
    for (const extra of fallback) {
      if (!seen.has(extra.featureKey)) rows.push(extra);
    }
    return rows;
  }

  async listSubscriptions(params: { status?: SubscriptionStatus; skip?: number; take?: number }) {
    const rows = await this.prisma.subscription.findMany({
      where: params.status ? { status: params.status } : undefined,
      skip: params.skip ?? 0,
      take: Math.min(params.take ?? 200, 300),
      orderBy: { updatedAt: 'desc' },
      include: {
        plan: true,
        team: {
          include: {
            salesReferral: {
              include: {
                partner: { select: { id: true, name: true, email: true, referralCode: true } },
              },
            },
          },
        },
        owner: { select: { id: true, email: true, name: true } },
      },
    });
    return rows.map((row) => {
      const referral = row.team?.salesReferral;
      return {
        ...row,
        referral: referral
          ? {
              id: referral.id,
              codeUsed: referral.codeUsed,
              partnerId: referral.partnerId,
              partnerName: referral.partner.name,
              partnerEmail: referral.partner.email,
              partnerReferralCode: referral.partner.referralCode,
            }
          : null,
      };
    });
  }

  async activate(
    adminUserId: string,
    teamId: string,
    planId: string,
    ownerUserId?: string,
    options?: { billingCycle?: BillingInterval; durationDays?: number; addRemainingDays?: boolean },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const billingCycle = options?.billingCycle ?? plan.interval;
    const yearlyCents = plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8);
    const mrrCents =
      billingCycle === BillingInterval.YEARLY
        ? Math.round(yearlyCents / 12)
        : plan.priceCents;
    const now = new Date();
    let baseDays =
      options?.durationDays && options.durationDays > 0
        ? options.durationDays
        : billingCycle === BillingInterval.YEARLY
          ? YEARLY_DAYS
          : MONTHLY_DAYS;
    let remainingDaysAdded = 0;
    if (options?.addRemainingDays) {
      const existing = await this.prisma.subscription.findUnique({ where: { teamId } });
      if (existing?.currentPeriodEnd) {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(existing.currentPeriodEnd);
        const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const left = Math.round((startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000);
        if (left > 0) {
          remainingDaysAdded = left;
          baseDays += left;
        }
      }
    }
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + baseDays);

    const sub = await this.prisma.subscription.upsert({
      where: { teamId },
      create: {
        teamId,
        planId,
        ownerUserId,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        expiredAt: null,
        gracePurgedAt: null,
        mrrCents,
      },
      update: {
        planId,
        ownerUserId,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        pausedAt: null,
        cancelledAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        expiredAt: null,
        gracePurgedAt: null,
        mrrCents,
      },
      include: { plan: true },
    });
    await this.audit.log({
      adminUserId,
      action: 'subscription.activate',
      resource: 'subscription',
      resourceId: sub.id,
      metadata: {
        planId,
        billingCycle,
        durationDays: baseDays,
        remainingDaysAdded,
        addRemainingDays: Boolean(options?.addRemainingDays),
      },
    });
    await this.billingAccess.restoreTeamIntegrations(teamId);
    // Same partner commission as Wayl-paid checkout (5k / 10k / 15k IQD by plan).
    await this.salesPartners
      .creditForSubscriptionActivation({
        teamId,
        subscriptionId: sub.id,
        planId,
        amountCents:
          billingCycle === BillingInterval.YEARLY
            ? yearlyCents
            : plan.priceCents,
        description: 'Admin manual subscription activation',
        provider: 'admin_manual',
      })
      .catch(() => null);
    return sub;
  }

  async updatePeriod(
    adminUserId: string,
    subscriptionId: string,
    input: {
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      extendDays?: number;
      reduceDays?: number;
      setDaysRemaining?: number;
      trialEndsAt?: string | null;
    },
  ) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const data: { currentPeriodStart?: Date; currentPeriodEnd?: Date; trialEndsAt?: Date | null } = {};

    if (input.currentPeriodStart) {
      const start = new Date(input.currentPeriodStart);
      if (Number.isNaN(start.getTime())) throw new BadRequestException('Invalid start date');
      data.currentPeriodStart = start;
    }

    if (input.currentPeriodEnd) {
      const end = new Date(input.currentPeriodEnd);
      if (Number.isNaN(end.getTime())) throw new BadRequestException('Invalid end date');
      data.currentPeriodEnd = end;
    } else if (input.setDaysRemaining !== undefined && input.setDaysRemaining >= 0) {
      const end = new Date();
      end.setDate(end.getDate() + input.setDaysRemaining);
      data.currentPeriodEnd = end;
      if (!sub.currentPeriodStart) data.currentPeriodStart = new Date();
    } else if (input.extendDays) {
      const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
      const end = new Date(base);
      end.setDate(end.getDate() + input.extendDays);
      data.currentPeriodEnd = end;
    } else if (input.reduceDays) {
      const base = sub.currentPeriodEnd ?? new Date();
      const end = new Date(base);
      end.setDate(end.getDate() - input.reduceDays);
      data.currentPeriodEnd = end;
    }

    if (input.trialEndsAt === null) {
      data.trialEndsAt = null;
    } else if (input.trialEndsAt) {
      const trialEnd = new Date(input.trialEndsAt);
      if (Number.isNaN(trialEnd.getTime())) throw new BadRequestException('Invalid trial end date');
      data.trialEndsAt = trialEnd;
    }

    if (!Object.keys(data).length) throw new BadRequestException('Nothing to update');

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data,
      include: { plan: true, team: true, owner: { select: { id: true, email: true, name: true } } },
    });
    await this.audit.log({
      adminUserId,
      action: 'subscription.update_period',
      resource: 'subscription',
      resourceId: subscriptionId,
      metadata: { ...input },
    });
    return updated;
  }

  async updateStatus(adminUserId: string, subscriptionId: string, status: SubscriptionStatus) {
    const data: Record<string, unknown> = { status };
    if (status === SubscriptionStatus.PAUSED) data.pausedAt = new Date();
    if (status === SubscriptionStatus.CANCELLED) {
      data.cancelledAt = new Date();
      data.mrrCents = 0;
    }
    if (status === SubscriptionStatus.ACTIVE) {
      data.pausedAt = null;
      data.cancelledAt = null;
    }
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: data as never,
      include: { plan: true, team: true },
    });
    if (status === SubscriptionStatus.ACTIVE) {
      await this.billingAccess.restoreTeamIntegrations(sub.teamId);
    } else if (status === SubscriptionStatus.EXPIRED || status === SubscriptionStatus.CANCELLED) {
      await this.billingAccess.suspendTeamIntegrations(sub.teamId);
    }
    await this.audit.log({
      adminUserId,
      action: 'subscription.update_status',
      resource: 'subscription',
      resourceId: subscriptionId,
      metadata: { status },
    });
    return sub;
  }

  async deleteSubscription(adminUserId: string, subscriptionId: string) {
    await this.audit.log({
      adminUserId,
      action: 'subscription.delete',
      resource: 'subscription',
      resourceId: subscriptionId,
    });
    return this.prisma.subscription.delete({ where: { id: subscriptionId } });
  }

  async pause(adminUserId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.PAUSED, pausedAt: new Date() },
    });
    await this.audit.log({ adminUserId, action: 'subscription.pause', resource: 'subscription', resourceId: subscriptionId });
    return sub;
  }

  async cancel(adminUserId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date(), mrrCents: 0 },
    });
    await this.audit.log({ adminUserId, action: 'subscription.cancel', resource: 'subscription', resourceId: subscriptionId });
    return sub;
  }

  async changePlan(adminUserId: string, subscriptionId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { planId, mrrCents: plan.priceCents },
      include: { plan: true },
    });
    await this.audit.log({
      adminUserId,
      action: 'subscription.change_plan',
      resource: 'subscription',
      resourceId: subscriptionId,
      metadata: { planId },
    });
    return sub;
  }

  async manualPayment(adminUserId: string, input: {
    subscriptionId: string;
    teamId: string;
    amountCents: number;
    description?: string;
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: input.subscriptionId,
        teamId: input.teamId,
        amountCents: input.amountCents,
        status: PaymentStatus.COMPLETED,
        description: input.description ?? 'Manual billing adjustment',
        paidAt: new Date(),
        provider: 'manual',
      },
    });
    await this.audit.log({ adminUserId, action: 'payment.manual', resource: 'payment', resourceId: payment.id });
    await this.salesPartners.creditFromPayment(payment.id).catch(() => null);
    return payment;
  }

  listInvoices(teamId?: string) {
    return this.prisma.invoice.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listPayments(teamId?: string) {
    return this.prisma.payment.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createInvoice(adminUserId: string, input: {
    subscriptionId: string;
    teamId: string;
    amountCents: number;
    number: string;
  }) {
    if (!input.number.trim()) throw new BadRequestException('Invoice number required');
    const invoice = await this.prisma.invoice.create({
      data: {
        subscriptionId: input.subscriptionId,
        teamId: input.teamId,
        number: input.number,
        amountCents: input.amountCents,
        status: InvoiceStatus.OPEN,
        dueAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    await this.audit.log({ adminUserId, action: 'invoice.create', resource: 'invoice', resourceId: invoice.id });
    return invoice;
  }
}
