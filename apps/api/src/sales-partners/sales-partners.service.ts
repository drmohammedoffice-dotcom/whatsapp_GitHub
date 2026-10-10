import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  PaymentStatus,
  Prisma,
  SalesCommissionKind,
  SalesCommissionMode,
  SalesCommissionStatus,
  SalesPartnerStatus,
  SalesPayoutMethod,
  SalesPayoutStatus,
  SalesReferralSource,
  SubscriptionStatus,
} from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { EncryptionService } from '../security/encryption.service';
import { TokenHashService } from '../security/token-hash.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { SalesPartnerEmailService } from './sales-partner-email.service';
import { ApplyPartnerDto, PartnerLoginDto, UpdateCommissionRuleDto } from './dto/sales-partners.dto';
import type { UploadedMediaFile } from '../common/uploaded-media-file';

const DEFAULT_PERCENTS: Record<string, number> = {
  basic: 20,
  professional: 25,
  business: 30,
};

/** Fixed partner earnings (IQD) per plan slug — Wayl + admin manual activation. */
const SUCCESS_PARTNER_IQD: Record<string, number> = {
  basic: 5000,
  starter: 5000,
  professional: 10000,
  pro: 10000,
  business: 15000,
};

/** Fallback by plan monthly USD cents when slug is custom. */
const SUCCESS_PARTNER_IQD_BY_USD_CENTS: Record<number, number> = {
  1500: 5000,
  2500: 5000,
  2900: 5000,
  3500: 10000,
  4900: 15000,
  7900: 10000,
  14900: 15000,
};

const PAYOUT_FEE_IQD = 500;
const PAYOUT_MIN_IQD = 10000;

function randomCode(prefix: string) {
  const base = prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'CL';
  const n = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${base}${n}`.slice(0, 10);
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

@Injectable()
export class SalesPartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly tokenHash: TokenHashService,
    private readonly storage: LocalStorageService,
    private readonly mail: SalesPartnerEmailService,
  ) {}

  webBase() {
    return (this.config.get<string>('WEB_PUBLIC_URL') ?? 'https://www.chatloora.com').replace(/\/$/, '');
  }

  referralLink(code: string) {
    return `${this.webBase()}/p/${encodeURIComponent(code)}`;
  }

  async apply(dto: ApplyPartnerDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.salesPartner.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === SalesPartnerStatus.REJECTED) {
        return this.prisma.salesPartner.update({
          where: { id: existing.id },
          data: {
            name: dto.name.trim(),
            phone: dto.phone.trim(),
            country: dto.country.trim(),
            reason: dto.reason.trim(),
            status: SalesPartnerStatus.PENDING,
            reviewedAt: null,
            reviewedBy: null,
          },
        });
      }
      throw new ConflictException('An application with this email already exists');
    }
    return this.prisma.salesPartner.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone.trim(),
        country: dto.country.trim(),
        reason: dto.reason.trim(),
      },
    });
  }

  async listApplications(status?: SalesPartnerStatus) {
    const rows = await this.prisma.salesPartner.findMany({
      where: status ? { status } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { referrals: true, commissions: true } },
      },
    });
    return rows.map(({ passwordHash: _h, passwordEncrypted: _e, ...row }) => row);
  }

  async listDirectory(q?: string) {
    const query = q?.trim();
    const partners = await this.prisma.salesPartner.findMany({
      where: {
        status: { in: [SalesPartnerStatus.APPROVED, SalesPartnerStatus.SUSPENDED] },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { referralCode: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    partners.sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
    const ids = partners.map((p) => p.id);
    const referrals = ids.length
      ? await this.prisma.salesReferral.findMany({
          where: { partnerId: { in: ids } },
          include: { team: { include: { subscriptions: true } } },
        })
      : [];
    const commissions = ids.length
      ? await this.prisma.salesCommission.findMany({ where: { partnerId: { in: ids } } })
      : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return partners.map((partner, index) => {
      const mine = referrals.filter((r) => r.partnerId === partner.id);
      let activeSubscriptions = 0;
      let expiredSubscriptions = 0;
      for (const ref of mine) {
        const sub = ref.team.subscriptions[0];
        if (!sub) {
          expiredSubscriptions += 1;
          continue;
        }
        const end = sub.currentPeriodEnd;
        const live =
          (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIAL) &&
          (!end || end.getTime() >= today.getTime());
        if (live) activeSubscriptions += 1;
        else expiredSubscriptions += 1;
      }
      const mineComm = commissions.filter((c) => c.partnerId === partner.id && c.status !== SalesCommissionStatus.REJECTED);
      const profitCents = mineComm.reduce((n, c) => n + c.amountCents, 0);
      const readyCents = commissions
        .filter((c) => c.partnerId === partner.id && c.status === SalesCommissionStatus.APPROVED)
        .reduce((n, c) => n + c.amountCents, 0);
      const { passwordHash: _h, passwordEncrypted: _e, ...safe } = partner;
      return {
        ...safe,
        index: index + 1,
        customers: mine.length,
        activeSubscriptions,
        expiredSubscriptions,
        profitCents,
        readyCents,
      };
    });
  }

  async getPartnerAdmin(id: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    const dashboard = await this.buildDashboard(partner.id);
    const payouts = await this.listPartnerPayouts(partner.id);
    return {
      ...dashboard,
      partner: {
        ...dashboard.partner,
        phone: partner.phone,
        country: partner.country,
        reason: partner.reason,
        createdAt: partner.createdAt,
        currentPassword: this.revealPassword(partner.passwordEncrypted),
      },
      payouts,
    };
  }

  async approve(id: string, adminUserId: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (partner.status === SalesPartnerStatus.APPROVED && partner.referralCode) {
      return { partner, temporaryPassword: null, referralLink: this.referralLink(partner.referralCode) };
    }

    let referralCode = partner.referralCode ?? randomCode(partner.name);
    while (await this.prisma.salesPartner.findFirst({ where: { referralCode, NOT: { id } } })) {
      referralCode = randomCode(partner.name);
    }

    const temporaryPassword = randomPassword();
    const updated = await this.prisma.salesPartner.update({
      where: { id },
      data: {
        status: SalesPartnerStatus.APPROVED,
        referralCode,
        passwordHash: await this.passwords.hash(temporaryPassword),
        passwordEncrypted: this.encryption.encryptJson({ password: temporaryPassword }),
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
      },
    });
    return {
      partner: updated,
      temporaryPassword,
      referralLink: this.referralLink(referralCode),
    };
  }

  async reject(id: string, adminUserId: string, notes?: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    return this.prisma.salesPartner.update({
      where: { id },
      data: {
        status: SalesPartnerStatus.REJECTED,
        notes: notes?.trim() || partner.notes,
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
      },
    });
  }

  async setStatus(id: string, status: SalesPartnerStatus) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    return this.prisma.salesPartner.update({ where: { id }, data: { status } });
  }

  async resetPassword(id: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (partner.status !== SalesPartnerStatus.APPROVED) {
      throw new BadRequestException('Partner must be approved first');
    }
    const temporaryPassword = randomPassword();
    await this.prisma.salesPartner.update({
      where: { id },
      data: {
        passwordHash: await this.passwords.hash(temporaryPassword),
        passwordEncrypted: this.encryption.encryptJson({ password: temporaryPassword }),
      },
    });
    return { temporaryPassword };
  }

  async setPassword(id: string, password: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (!password || password.length < 8) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
    await this.prisma.salesPartner.update({
      where: { id },
      data: {
        passwordHash: await this.passwords.hash(password),
        passwordEncrypted: this.encryption.encryptJson({ password }),
      },
    });
    return { updated: true };
  }

  async updatePartnerEmail(id: string, email: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      throw new BadRequestException('أدخل بريداً إلكترونياً صحيحاً');
    }
    const taken = await this.prisma.salesPartner.findUnique({ where: { email: next } });
    if (taken && taken.id !== id) throw new ConflictException('هذا البريد مستخدم لحساب شريك آخر');
    const updated = await this.prisma.salesPartner.update({ where: { id }, data: { email: next } });
    return { id: updated.id, email: updated.email };
  }

  async deletePartner(id: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    await this.prisma.salesPartner.delete({ where: { id } });
    return { deleted: true };
  }

  async ensureRules() {
    const plans = await this.prisma.subscriptionPlan.findMany();
    for (const plan of plans) {
      const existing = await this.prisma.salesCommissionRule.findUnique({ where: { planId: plan.id } });
      if (existing) continue;
      await this.prisma.salesCommissionRule.create({
        data: {
          planId: plan.id,
          mode: SalesCommissionMode.PERCENT,
          percent: DEFAULT_PERCENTS[plan.slug] ?? 20,
          fixedCents: 0,
        },
      });
    }
    return this.prisma.salesCommissionRule.findMany({
      include: { plan: true },
      orderBy: { plan: { sortOrder: 'asc' } },
    });
  }

  async updateRule(dto: UpdateCommissionRuleDto) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { OR: [{ id: dto.planId }, { slug: dto.planId }] },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    const mode = dto.mode === 'FIXED' ? SalesCommissionMode.FIXED : SalesCommissionMode.PERCENT;
    const percent = Math.max(0, Math.min(100, Number(dto.percent ?? 0)));
    const fixedCents = Math.max(0, Math.round(Number(dto.fixedCents ?? 0)));
    return this.prisma.salesCommissionRule.upsert({
      where: { planId: plan.id },
      create: { planId: plan.id, mode, percent, fixedCents },
      update: { mode, percent, fixedCents },
      include: { plan: true },
    });
  }

  async attachReferral(teamId: string, userId: string | undefined, rawCode: string | undefined, source?: SalesReferralSource) {
    const code = (rawCode ?? '').trim().toUpperCase();
    if (!code) return null;
    const partner = await this.prisma.salesPartner.findFirst({
      where: { referralCode: code, status: SalesPartnerStatus.APPROVED },
    });
    if (!partner) return null;
    const existing = await this.prisma.salesReferral.findUnique({ where: { teamId } });
    if (existing) return existing;
    return this.prisma.salesReferral.create({
      data: {
        partnerId: partner.id,
        teamId,
        userId: userId ?? null,
        source: source === SalesReferralSource.LINK ? SalesReferralSource.LINK : SalesReferralSource.CODE,
        codeUsed: code,
      },
    });
  }

  /** Resolve fixed IQD commission for a plan (slug first, then USD price, then DB rule). */
  resolvePartnerIqd(
    plan: { slug: string; priceCents: number },
    saleCents: number,
    ruleFixedCents?: number | null,
    ruleMode?: SalesCommissionMode | null,
    rulePercent?: unknown,
  ) {
    const slug = (plan.slug || '').toLowerCase().trim();
    const bySlug = SUCCESS_PARTNER_IQD[slug];
    if (bySlug) return bySlug;
    const byPrice = SUCCESS_PARTNER_IQD_BY_USD_CENTS[plan.priceCents];
    if (byPrice) return byPrice;
    if (ruleMode === SalesCommissionMode.FIXED && ruleFixedCents) return ruleFixedCents;
    const percent = Number(rulePercent ?? DEFAULT_PERCENTS[slug] ?? 20);
    return Math.round((saleCents * percent) / 100);
  }

  /**
   * Credit partner wallet after any completed activation payment (Wayl or admin manual).
   * Idempotent per paymentId.
   */
  async creditFromPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) return null;
    const already = await this.prisma.salesCommission.findUnique({ where: { paymentId } });
    if (already) return already;
    const referral = await this.prisma.salesReferral.findUnique({ where: { teamId: payment.teamId } });
    if (!referral) return null;
    const partner = await this.prisma.salesPartner.findUnique({ where: { id: referral.partnerId } });
    if (!partner || partner.status !== SalesPartnerStatus.APPROVED) return null;

    await this.ensureRules();
    const rule = await this.prisma.salesCommissionRule.findUnique({ where: { planId: payment.subscription.planId } });
    const saleCents = payment.amountCents;
    const amountCents = this.resolvePartnerIqd(
      payment.subscription.plan,
      saleCents,
      rule?.fixedCents,
      rule?.mode,
      rule?.percent,
    );
    if (amountCents <= 0) return null;

    const prior = await this.prisma.salesCommission.count({
      where: { referralId: referral.id, status: { not: SalesCommissionStatus.REJECTED } },
    });
    const kind = prior === 0 ? SalesCommissionKind.FIRST : SalesCommissionKind.RENEWAL;

    return this.prisma.salesCommission.create({
      data: {
        partnerId: partner.id,
        referralId: referral.id,
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId,
        teamId: payment.teamId,
        planId: payment.subscription.planId,
        kind,
        status: SalesCommissionStatus.APPROVED,
        approvedAt: new Date(),
        amountCents,
        currency: 'IQD',
        saleCents,
      },
    });
  }

  /**
   * Create a completed manual payment for an activated subscription and credit the referring partner.
   * Used by admin panel activate and AI/email activation (same earnings as Wayl).
   */
  async creditForSubscriptionActivation(input: {
    teamId: string;
    subscriptionId: string;
    planId: string;
    amountCents?: number;
    description?: string;
    provider?: string;
  }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan) return null;
    const referral = await this.prisma.salesReferral.findUnique({ where: { teamId: input.teamId } });
    if (!referral) return null;

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: input.subscriptionId,
        teamId: input.teamId,
        amountCents: input.amountCents ?? plan.priceCents,
        currency: plan.currency || 'USD',
        status: PaymentStatus.COMPLETED,
        description: input.description ?? 'Admin subscription activation',
        paidAt: new Date(),
        provider: input.provider ?? 'admin_manual',
      },
    });

    return this.creditFromPayment(payment.id);
  }

  async listCommissions(filters: { status?: SalesCommissionStatus; partnerId?: string }) {
    return this.prisma.salesCommission.findMany({
      where: {
        status: filters.status,
        partnerId: filters.partnerId,
      },
      include: {
        partner: { select: { id: true, name: true, email: true, referralCode: true } },
        referral: { include: { team: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async setCommissionStatus(id: string, status: SalesCommissionStatus) {
    const row = await this.prisma.salesCommission.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Commission not found');
    const data: Prisma.SalesCommissionUpdateInput = { status };
    if (status === SalesCommissionStatus.APPROVED) data.approvedAt = new Date();
    if (status === SalesCommissionStatus.PAID) data.paidAt = new Date();
    return this.prisma.salesCommission.update({ where: { id }, data });
  }

  async walletOverview() {
    const groups = await this.prisma.salesCommission.groupBy({
      by: ['status'],
      _sum: { amountCents: true },
      _count: true,
    });
    const wallet = {
      pendingCents: 0,
      approvedCents: 0,
      paidCents: 0,
      rejectedCents: 0,
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0,
    };
    for (const g of groups) {
      const sum = g._sum.amountCents ?? 0;
      if (g.status === SalesCommissionStatus.PENDING) {
        wallet.pendingCents = sum;
        wallet.pendingCount = g._count;
      }
      if (g.status === SalesCommissionStatus.APPROVED) {
        wallet.approvedCents = sum;
        wallet.approvedCount = g._count;
      }
      if (g.status === SalesCommissionStatus.PAID) {
        wallet.paidCents = sum;
        wallet.paidCount = g._count;
      }
      if (g.status === SalesCommissionStatus.REJECTED) wallet.rejectedCents = sum;
    }
    return wallet;
  }

  async partnerLogin(dto: PartnerLoginDto) {
    const partner = await this.prisma.salesPartner.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!partner?.passwordHash || partner.status !== SalesPartnerStatus.APPROVED) {
      throw new UnauthorizedException('Invalid partner credentials');
    }
    if (!(await this.passwords.verify(dto.password, partner.passwordHash))) {
      throw new UnauthorizedException('Invalid partner credentials');
    }
    const accessToken = await this.jwt.signAsync(
      { sub: partner.id, scope: 'sales-partner', email: partner.email },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '7d' },
    );
    return { accessToken, partner: this.publicPartner(partner) };
  }

  async partnerMe(partnerId: string) {
    const partner = await this.requireApproved(partnerId);
    return this.buildDashboard(partner.id);
  }

  async changePartnerPassword(partnerId: string, currentPassword: string, newPassword: string) {
    const partner = await this.requireApproved(partnerId);
    if (!partner.passwordHash || !(await this.passwords.verify(currentPassword, partner.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    await this.prisma.salesPartner.update({
      where: { id: partner.id },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        passwordEncrypted: this.encryption.encryptJson({ password: newPassword }),
      },
    });
    return { updated: true };
  }

  async resolvePartnerFromToken(token: string) {
    let payload: { sub?: string; scope?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid partner token');
    }
    if (payload.scope !== 'sales-partner' || !payload.sub) {
      throw new UnauthorizedException('Invalid partner token');
    }
    return this.requireApproved(payload.sub);
  }

  private async requireApproved(id: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (partner.status === SalesPartnerStatus.SUSPENDED) throw new ForbiddenException('Partner account is suspended');
    if (partner.status !== SalesPartnerStatus.APPROVED) throw new ForbiddenException('Partner is not approved');
    return partner;
  }

  private publicPartner(partner: {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    referralCode: string | null;
    status: SalesPartnerStatus;
    age?: number | null;
    city?: string | null;
    avatarKey?: string | null;
  }) {
    return {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      country: partner.country,
      city: partner.city ?? partner.country,
      age: partner.age ?? null,
      hasAvatar: Boolean(partner.avatarKey),
      referralCode: partner.referralCode,
      referralLink: partner.referralCode ? this.referralLink(partner.referralCode) : null,
      status: partner.status,
    };
  }

  private async buildDashboard(partnerId: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const referrals = await this.prisma.salesReferral.findMany({
      where: { partnerId },
      include: {
        user: { select: { email: true, name: true } },
        team: { include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const commissions = await this.prisma.salesCommission.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });

    const customers = referrals.length;
    let activeSubscriptions = 0;
    let expiredSubscriptions = 0;
    for (const ref of referrals) {
      const sub = ref.team.subscriptions[0];
      if (!sub) {
        expiredSubscriptions += 1;
        continue;
      }
      const end = sub.currentPeriodEnd;
      const live =
        (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIAL) &&
        (!end || end.getTime() >= startOfDay.getTime());
      if (live) activeSubscriptions += 1;
      else expiredSubscriptions += 1;
    }

    const inRange = (rows: typeof commissions, from: Date) =>
      rows.filter((c) => c.createdAt >= from && c.status !== SalesCommissionStatus.REJECTED);

    const sumSale = (rows: typeof commissions) => rows.reduce((n, c) => n + c.saleCents, 0);
    const sumComm = (rows: typeof commissions, status?: SalesCommissionStatus) =>
      rows.filter((c) => (status ? c.status === status : true)).reduce((n, c) => n + c.amountCents, 0);

    const daily = inRange(commissions, startOfDay);
    const monthly = inRange(commissions, startOfMonth);
    const valid = commissions.filter((c) => c.status !== SalesCommissionStatus.REJECTED);
    const readyCents = sumComm(commissions, SalesCommissionStatus.APPROVED);
    const reserved = await this.reservedPayoutCents(partnerId);
    const availablePayoutCents = Math.max(0, readyCents - reserved);
    const payouts = await this.listPartnerPayouts(partnerId);

    return {
      partner: this.publicPartner(partner),
      stats: {
        customers,
        activeSubscriptions,
        expiredSubscriptions,
        salesCents: sumSale(valid),
        pendingCents: sumComm(commissions, SalesCommissionStatus.PENDING),
        readyCents,
        paidCents: sumComm(commissions, SalesCommissionStatus.PAID),
        availablePayoutCents,
        daily: {
          customers: referrals.filter((r) => r.createdAt >= startOfDay).length,
          salesCents: sumSale(daily),
          commissionsCents: sumComm(daily),
        },
        monthly: {
          customers: referrals.filter((r) => r.createdAt >= startOfMonth).length,
          salesCents: sumSale(monthly),
          commissionsCents: sumComm(monthly),
        },
      },
      commissions: commissions.slice(0, 50).map((c) => ({
        id: c.id,
        kind: c.kind,
        status: c.status,
        amountCents: c.amountCents,
        saleCents: c.saleCents,
        currency: c.currency,
        createdAt: c.createdAt,
        paidAt: c.paidAt,
      })),
      referrals: referrals.slice(0, 100).map((r) => {
        const sub = r.team.subscriptions[0];
        const end = sub?.currentPeriodEnd ?? null;
        const live =
          !!sub &&
          (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIAL) &&
          (!end || end.getTime() >= startOfDay.getTime());
        const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)) : null;
        return {
          id: r.id,
          teamName: r.team.name,
          email: r.user?.email ?? null,
          source: r.source,
          createdAt: r.createdAt,
          subscriptionStatus: live ? 'ACTIVE' : sub ? 'EXPIRED' : 'NONE',
          planName: sub?.plan?.nameAr || sub?.plan?.name || null,
          daysLeft,
          periodEnd: end,
        };
      }),
      payouts,
    };
  }

  private revealPassword(encrypted?: string | null) {
    if (!encrypted) return null;
    try {
      return this.encryption.decryptJson<{ password?: string }>(encrypted).password ?? null;
    } catch {
      return null;
    }
  }

  private async reservedPayoutCents(partnerId: string) {
    const rows = await this.prisma.salesPayoutRequest.findMany({
      where: {
        partnerId,
        status: { in: [SalesPayoutStatus.AWAITING_EMAIL, SalesPayoutStatus.SUBMITTED, SalesPayoutStatus.APPROVED] },
      },
    });
    return rows.reduce((n, r) => n + r.amountCents, 0);
  }

  private mapPayout(row: {
    id: string;
    amountCents: number;
    currency: string;
    accountNumber: string;
    accountName?: string | null;
    method?: SalesPayoutMethod | null;
    feeCents?: number;
    netCents?: number;
    accountImageKey: string | null;
    receiptImageKey: string | null;
    status: SalesPayoutStatus;
    adminNote: string | null;
    paidAt: Date | null;
    createdAt: Date;
    emailVerifiedAt: Date | null;
  }) {
    const feeCents = row.feeCents ?? 0;
    const netCents = row.netCents && row.netCents > 0 ? row.netCents : Math.max(0, row.amountCents - feeCents);
    return {
      id: row.id,
      amountCents: row.amountCents,
      feeCents,
      netCents,
      currency: row.currency,
      method: row.method ?? null,
      accountName: row.accountName ?? null,
      accountNumber: row.accountNumber,
      hasAccountImage: Boolean(row.accountImageKey),
      hasReceiptImage: Boolean(row.receiptImageKey),
      status: row.status,
      adminNote: row.adminNote,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      emailVerifiedAt: row.emailVerifiedAt,
    };
  }

  async listPartnerPayouts(partnerId: string) {
    const rows = await this.prisma.salesPayoutRequest.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapPayout(row));
  }

  async listAllPayouts(status?: SalesPayoutStatus) {
    const rows = await this.prisma.salesPayoutRequest.findMany({
      where: status ? { status } : { status: { not: SalesPayoutStatus.AWAITING_EMAIL } },
      include: { partner: { select: { id: true, name: true, email: true, phone: true, referralCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({ ...this.mapPayout(row), partner: row.partner }));
  }

  async createPayoutDraft(
    partnerId: string,
    amountCents: number,
    accountNumber: string,
    file?: UploadedMediaFile,
    withdrawAll?: boolean,
  ) {
    const dashboard = await this.buildDashboard(partnerId);
    const available = dashboard.stats.availablePayoutCents;
    const amount = withdrawAll ? available : Math.round(Number(amountCents));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('أدخل مبلغاً صحيحاً');
    if (amount > available) throw new BadRequestException('المبلغ أكبر من الرصيد الجاهز للسحب');
    const account = accountNumber.trim();
    if (account.length < 6) throw new BadRequestException('أدخل رقم بطاقة أو حساب SuperQi');
    if (!file) throw new BadRequestException('أرفق صورة البطاقة أو الحساب');
    const imageKey = await this.storePayoutImage(partnerId, file);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const row = await this.prisma.salesPayoutRequest.create({
      data: {
        partnerId,
        amountCents: amount,
        accountNumber: account,
        accountImageKey: imageKey,
        status: SalesPayoutStatus.AWAITING_EMAIL,
        emailCodeHash: this.tokenHash.hash(code),
        emailCodeExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const partner = await this.requireApproved(partnerId);
    await this.mail.sendPayoutCode({
      to: partner.email,
      name: partner.name,
      code,
      amountLabel: `${amount.toLocaleString('en-US')} IQD`,
    });
    return { id: row.id, emailed: true };
  }

  async confirmPayout(partnerId: string, payoutId: string, code: string) {
    const row = await this.prisma.salesPayoutRequest.findFirst({
      where: { id: payoutId, partnerId },
    });
    if (!row) throw new NotFoundException('Payout not found');
    if (row.status !== SalesPayoutStatus.AWAITING_EMAIL) {
      throw new BadRequestException('تم إرسال هذا الطلب مسبقاً');
    }
    if (!row.emailCodeHash || !row.emailCodeExpiresAt || row.emailCodeExpiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية رمز التأكيد. اطلب رمزاً جديداً');
    }
    if (this.tokenHash.hash(code.trim()) !== row.emailCodeHash) {
      throw new BadRequestException('رمز التأكيد غير صحيح');
    }
    return this.prisma.salesPayoutRequest.update({
      where: { id: row.id },
      data: {
        status: SalesPayoutStatus.SUBMITTED,
        emailVerifiedAt: new Date(),
        emailCodeHash: null,
        emailCodeExpiresAt: null,
      },
    });
  }

  async resendPayoutCode(partnerId: string, payoutId: string) {
    const row = await this.prisma.salesPayoutRequest.findFirst({
      where: { id: payoutId, partnerId, status: SalesPayoutStatus.AWAITING_EMAIL },
    });
    if (!row) throw new NotFoundException('Payout not found');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.salesPayoutRequest.update({
      where: { id: row.id },
      data: {
        emailCodeHash: this.tokenHash.hash(code),
        emailCodeExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const partner = await this.requireApproved(partnerId);
    await this.mail.sendPayoutCode({
      to: partner.email,
      name: partner.name,
      code,
      amountLabel: `${row.amountCents.toLocaleString('en-US')} IQD`,
    });
    return { emailed: true };
  }

  async setPayoutStatus(id: string, status: SalesPayoutStatus, note?: string) {
    const row = await this.prisma.salesPayoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Payout not found');
    return this.prisma.salesPayoutRequest.update({
      where: { id },
      data: { status, adminNote: note?.trim() || row.adminNote },
    });
  }

  async markPayoutPaid(id: string, file?: UploadedMediaFile, note?: string) {
    const row = await this.prisma.salesPayoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Payout not found');
    if (row.status === SalesPayoutStatus.PAID) return this.mapPayout(row);
    if (row.status !== SalesPayoutStatus.SUBMITTED && row.status !== SalesPayoutStatus.APPROVED) {
      throw new BadRequestException('لا يمكن دفع هذا الطلب بحالته الحالية');
    }
    if (!file && !row.receiptImageKey) {
      throw new BadRequestException('أرفق صورة فاتورة الدفع');
    }
    const receiptImageKey = file ? await this.storePayoutImage(row.partnerId, file) : row.receiptImageKey;
    await this.applyPaidCommissions(row.partnerId, row.amountCents);
    const updated = await this.prisma.salesPayoutRequest.update({
      where: { id },
      data: {
        status: SalesPayoutStatus.PAID,
        paidAt: new Date(),
        receiptImageKey,
        adminNote: note?.trim() || row.adminNote,
      },
    });
    const partner = await this.prisma.salesPartner.findUnique({ where: { id: row.partnerId } });
    if (partner) {
      await this.mail.sendPayoutPaid({
        to: partner.email,
        name: partner.name,
        amountLabel: `${row.amountCents.toLocaleString('en-US')} IQD`,
      });
    }
    return this.mapPayout(updated);
  }

  private async applyPaidCommissions(partnerId: string, amountCents: number) {
    const rows = await this.prisma.salesCommission.findMany({
      where: { partnerId, status: SalesCommissionStatus.APPROVED },
      orderBy: { createdAt: 'asc' },
    });
    let remaining = amountCents;
    for (const row of rows) {
      if (remaining <= 0) break;
      await this.prisma.salesCommission.update({
        where: { id: row.id },
        data: { status: SalesCommissionStatus.PAID, paidAt: new Date() },
      });
      remaining -= row.amountCents;
    }
  }

  private async storePayoutImage(partnerId: string, file: UploadedMediaFile) {
    if (!file?.buffer?.length) throw new BadRequestException('الصورة مطلوبة');
    if (!file.mimetype?.startsWith('image/')) throw new BadRequestException('يُسمح برفع الصور فقط');
    if (file.size > 8 * 1024 * 1024) throw new BadRequestException('حجم الصورة يجب أن يكون أقل من 8MB');
    const stored = await this.storage.putMedia(`partners/${partnerId}`, file);
    return stored.storageKey;
  }

  async openPayoutFile(payoutId: string, kind: 'account' | 'receipt', partnerId?: string) {
    const row = await this.prisma.salesPayoutRequest.findUnique({ where: { id: payoutId } });
    if (!row) throw new NotFoundException('Payout not found');
    if (partnerId && row.partnerId !== partnerId) throw new ForbiddenException();
    const key = kind === 'receipt' ? row.receiptImageKey : row.accountImageKey;
    if (!key) throw new NotFoundException('File not found');
    const { createReadStream } = await import('fs');
    const { extname } = await import('path');
    const path = this.storage.resolvePath(key);
    const ext = extname(key).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    return { stream: createReadStream(path), type };
  }

  async successPartnerState(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const partner = await this.prisma.salesPartner.findUnique({ where: { userId } });
    if (!partner || partner.status === SalesPartnerStatus.REJECTED) {
      return {
        stage: 'landing' as const,
        suggested: { name: user.name, email: user.email, phone: user.phone ?? '' },
      };
    }
    if (partner.joinCodeHash) {
      return { stage: 'verify' as const, email: partner.email };
    }
    if (partner.status !== SalesPartnerStatus.APPROVED || !partner.referralCode) {
      return { stage: 'verify' as const, email: partner.email };
    }
    const dashboard = await this.buildDashboard(partner.id);
    return { stage: 'dashboard' as const, ...dashboard };
  }

  async startSuccessPartner(
    userId: string,
    input: { name: string; age: number; city: string; phone: string; email: string; password: string; passwordConfirm: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const name = input.name.trim();
    const city = input.city.trim();
    const phone = input.phone.trim();
    const email = user.email.trim().toLowerCase();
    const password = input.password;
    const age = Math.round(Number(input.age));
    if (name.length < 3) throw new BadRequestException('أدخل الاسم الكامل');
    if (!Number.isFinite(age) || age < 16 || age > 100) throw new BadRequestException('أدخل عمراً صحيحاً');
    if (city.length < 2) throw new BadRequestException('أدخل السكن');
    if (phone.replace(/\D/g, '').length < 8) throw new BadRequestException('أدخل رقم هاتف صحيح');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('حسابك لا يملك بريداً إلكترونياً');
    if (!password || password.length < 8) throw new BadRequestException('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    if (password !== input.passwordConfirm) throw new BadRequestException('كلمتا المرور غير متطابقتين');

    const mine = await this.prisma.salesPartner.findUnique({ where: { userId } });
    if (mine?.status === SalesPartnerStatus.APPROVED && mine.referralCode) {
      throw new BadRequestException('حساب الشريك مفعّل بالفعل');
    }
    const byEmail = await this.prisma.salesPartner.findUnique({ where: { email } });
    if (byEmail && byEmail.userId && byEmail.userId !== userId) {
      throw new ConflictException('هذا البريد مستخدم لحساب شريك آخر');
    }
    if (byEmail && mine && byEmail.id !== mine.id) {
      throw new ConflictException('هذا البريد مستخدم لحساب شريك آخر');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const data = {
      name,
      email,
      phone,
      country: city,
      city,
      age,
      reason: 'كن شريكنا بالنجاح',
      userId,
      passwordHash: await this.passwords.hash(password),
      passwordEncrypted: this.encryption.encryptJson({ password }),
      joinCodeHash: this.tokenHash.hash(code),
      joinCodeExpiresAt: new Date(Date.now() + 15 * 60_000),
    };
    const target = mine ?? (byEmail && !byEmail.userId ? byEmail : null);
    if (byEmail && byEmail.userId === userId) {
      await this.prisma.salesPartner.update({ where: { id: byEmail.id }, data });
    } else if (target) {
      await this.prisma.salesPartner.update({ where: { id: target.id }, data });
    } else {
      await this.prisma.salesPartner.create({ data: { ...data, status: SalesPartnerStatus.PENDING } });
    }
    await this.mail.sendJoinCode({ to: email, name, code });
    return { stage: 'verify' as const, email };
  }

  async confirmSuccessPartner(userId: string, code: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { userId } });
    if (!partner) throw new BadRequestException('ابدأ التسجيل أولاً');
    if (!partner.joinCodeHash || !partner.joinCodeExpiresAt || partner.joinCodeExpiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية رمز التأكيد. اطلب رمزاً جديداً');
    }
    if (this.tokenHash.hash(code.trim()) !== partner.joinCodeHash) {
      throw new BadRequestException('رمز التأكيد غير صحيح');
    }
    let referralCode = partner.referralCode ?? randomCode(partner.name);
    while (await this.prisma.salesPartner.findFirst({ where: { referralCode, NOT: { id: partner.id } } })) {
      referralCode = randomCode(partner.name);
    }
    await this.prisma.salesPartner.update({
      where: { id: partner.id },
      data: {
        status: SalesPartnerStatus.APPROVED,
        referralCode,
        reviewedAt: partner.reviewedAt ?? new Date(),
        joinCodeHash: null,
        joinCodeExpiresAt: null,
      },
    });
    return this.successPartnerState(userId);
  }

  async createSuccessTicket(
    userId: string,
    teamId: string | undefined,
    input: { email: string; subject: string; message: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const subject = input.subject.trim();
    const message = input.message.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('أدخل بريداً إلكترونياً صحيحاً');
    if (subject.length < 3) throw new BadRequestException('أدخل عنوان التذكرة');
    if (message.length < 5) throw new BadRequestException('اكتب المشكلة أو الاستفسار');
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        teamId: teamId || null,
        subject,
        messages: { create: { body: `البريد: ${email}\n\n${message}` } },
      },
    });
    return { id: ticket.id, sent: true };
  }

  async resendSuccessCode(userId: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { userId } });
    if (!partner) throw new BadRequestException('ابدأ التسجيل أولاً');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.salesPartner.update({
      where: { id: partner.id },
      data: {
        joinCodeHash: this.tokenHash.hash(code),
        joinCodeExpiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    await this.mail.sendJoinCode({ to: partner.email, name: partner.name, code });
    return { emailed: true, email: partner.email };
  }

  async saveSuccessAvatar(userId: string, file?: UploadedMediaFile) {
    const partner = await this.requireUserPartner(userId);
    if (!file) throw new BadRequestException('اختر صورة');
    const avatarKey = await this.storePayoutImage(partner.id, file);
    await this.prisma.salesPartner.update({ where: { id: partner.id }, data: { avatarKey } });
    return { updated: true };
  }

  async openSuccessAvatar(userId: string) {
    const partner = await this.requireUserPartner(userId);
    if (!partner.avatarKey) throw new NotFoundException('لا توجد صورة');
    const { createReadStream } = await import('fs');
    const { extname } = await import('path');
    const filePath = this.storage.resolvePath(partner.avatarKey);
    const ext = extname(partner.avatarKey).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    return { stream: createReadStream(filePath), type };
  }

  async openSuccessReceipt(userId: string, payoutId: string) {
    const partner = await this.requireUserPartner(userId);
    return this.openPayoutFile(payoutId, 'receipt', partner.id);
  }

  async createSuccessPayout(
    userId: string,
    input: { amountCents: number; method: 'ZAIN_CASH' | 'MASTERCARD'; accountNumber: string; accountName?: string },
  ) {
    const partner = await this.requireUserPartner(userId);
    const dashboard = await this.buildDashboard(partner.id);
    const amount = Math.round(Number(input.amountCents));
    if (!Number.isFinite(amount) || amount < PAYOUT_MIN_IQD) {
      throw new BadRequestException('أدنى مبلغ للسحب هو 10,000 دينار عراقي');
    }
    if (amount > dashboard.stats.availablePayoutCents) {
      throw new BadRequestException('المبلغ أكبر من الأرباح المتاحة للسحب');
    }
    const method = input.method === 'MASTERCARD' ? SalesPayoutMethod.MASTERCARD : SalesPayoutMethod.ZAIN_CASH;
    const accountNumber = input.accountNumber.trim();
    const accountName = input.accountName?.trim() || '';
    if (method === SalesPayoutMethod.ZAIN_CASH && accountNumber.replace(/\D/g, '').length < 8) {
      throw new BadRequestException('أدخل رقم هاتف حساب زين كاش');
    }
    if (method === SalesPayoutMethod.MASTERCARD) {
      if (accountName.length < 3) throw new BadRequestException('أدخل اسم صاحب البطاقة');
      if (accountNumber.replace(/\s/g, '').length < 8) throw new BadRequestException('أدخل رقم البطاقة أو المحفظة');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const netCents = amount - PAYOUT_FEE_IQD;
    const row = await this.prisma.salesPayoutRequest.create({
      data: {
        partnerId: partner.id,
        amountCents: amount,
        feeCents: PAYOUT_FEE_IQD,
        netCents,
        currency: 'IQD',
        method,
        accountNumber,
        accountName: accountName || null,
        status: SalesPayoutStatus.AWAITING_EMAIL,
        emailCodeHash: this.tokenHash.hash(code),
        emailCodeExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    await this.mail.sendPayoutCode({
      to: partner.email,
      name: partner.name,
      code,
      amountLabel: `${netCents.toLocaleString('en-US')} IQD`,
    });
    return { id: row.id, emailed: true, email: partner.email, netCents, feeCents: PAYOUT_FEE_IQD };
  }

  async getPayoutAdmin(id: string) {
    const row = await this.prisma.salesPayoutRequest.findUnique({
      where: { id },
      include: { partner: true },
    });
    if (!row) throw new NotFoundException('Payout not found');
    const { passwordHash: _h, passwordEncrypted: _e, joinCodeHash: _c, ...partner } = row.partner;
    return {
      ...this.mapPayout(row),
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        city: partner.city,
        age: partner.age,
        country: partner.country,
        referralCode: partner.referralCode,
      },
    };
  }

  async confirmSuccessPayout(userId: string, payoutId: string, code: string) {
    const partner = await this.requireUserPartner(userId);
    await this.confirmPayout(partner.id, payoutId, code);
    return this.successPartnerState(userId);
  }

  private async requireUserPartner(userId: string) {
    const partner = await this.prisma.salesPartner.findUnique({ where: { userId } });
    if (!partner || partner.status !== SalesPartnerStatus.APPROVED) {
      throw new ForbiddenException('فعّل حساب الشريك أولاً');
    }
    return partner;
  }
}
