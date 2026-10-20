import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminNotificationChannel, NotificationType, PaymentStatus, SubscriptionStatus } from '@watsapp/database';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { AiGatewayService } from '../../ai/gateway/ai-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

const PROGRAM_KEY = 'subscriber_notice_program';

type NoticeTemplate = {
  kind: string;
  title: string;
  body: string;
  enabled: boolean;
  daysBefore: number;
};

const DEFAULT_TEMPLATES: NoticeTemplate[] = [
  { kind: 'EXPIRING', title: 'اشتراكك يقترب من الانتهاء', body: 'مرحباً {name}، تبقّى {days} يوم على باقة {plan}. جدّد الآن حتى لا تتوقف الخدمة.', enabled: true, daysBefore: 7 },
  { kind: 'EXPIRING_SOON', title: 'تذكير أخير قبل انتهاء الاشتراك', body: 'مرحباً {name}، باقة {plan} تنتهي خلال {days} يوم. جدّد اليوم.', enabled: true, daysBefore: 2 },
  { kind: 'RENEWAL_INVOICE', title: 'فاتورة تجديد الاشتراك', body: 'مرحباً {name}، فاتورة تجديد باقة {plan} بمبلغ {amount} جاهزة. تبقّى {days} يوم.', enabled: true, daysBefore: 3 },
  { kind: 'EXPIRED', title: 'انتهى اشتراكك', body: 'مرحباً {name}، انتهت باقة {plan}. جدّد الاشتراك لاستعادة الحساب.', enabled: true, daysBefore: 0 },
  { kind: 'ACTIVATED', title: 'تم تفعيل اشتراكك', body: 'مرحباً {name}، تم تفعيل باقة {plan}. نتمنى لك عملاً موفقاً.', enabled: true, daysBefore: 0 },
  { kind: 'PAYMENT', title: 'تم استلام دفعة الاشتراك', body: 'مرحباً {name}، استلمنا دفعة باقة {plan} بمبلغ {amount}.', enabled: true, daysBefore: 0 },
  { kind: 'MARKETING', title: 'رسالة من ChatLoora', body: 'مرحباً {name}، لدينا عرض جديد على باقة {plan}.', enabled: true, daysBefore: 0 },
];

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly config: ConfigService,
    private readonly gateway: AiGatewayService,
  ) {}

  list(params: { skip?: number; take?: number }) {
    return this.prisma.platformNotification.findMany({
      skip: params.skip ?? 0,
      take: Math.min(params.take ?? 50, 100),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async sendToUser(adminUserId: string, input: {
    userId: string;
    title: string;
    body: string;
    channel: AdminNotificationChannel;
  }) {
    const notification = await this.prisma.platformNotification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        channel: input.channel,
        sentAt: new Date(),
      },
    });
    await this.audit.log({
      adminUserId,
      action: 'notification.send',
      resource: 'notification',
      resourceId: notification.id,
      metadata: { userId: input.userId, channel: input.channel },
    });
    return notification;
  }

  async broadcast(adminUserId: string, input: { title: string; body: string; channel: AdminNotificationChannel }) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    const notifications = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.platformNotification.create({
          data: {
            userId: u.id,
            title: input.title,
            body: input.body,
            channel: input.channel,
            sentAt: new Date(),
          },
        }),
      ),
    );
    await this.audit.log({
      adminUserId,
      action: 'notification.broadcast',
      resource: 'notification',
      metadata: { count: notifications.length, channel: input.channel },
    });
    return { sent: notifications.length };
  }

  async getProgram() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: PROGRAM_KEY } });
    const stored = Array.isArray(row?.value) ? (row.value as NoticeTemplate[]) : [];
    const templates = DEFAULT_TEMPLATES.map((item) => stored.find((row) => row.kind === item.kind) ?? item);
    return { templates };
  }

  async saveProgram(adminUserId: string, templates: NoticeTemplate[]) {
    const clean = DEFAULT_TEMPLATES.map((item) => {
      const next = templates.find((row) => row.kind === item.kind);
      return {
        kind: item.kind,
        title: (next?.title || item.title).trim().slice(0, 160),
        body: (next?.body || item.body).trim().slice(0, 1000),
        enabled: next?.enabled ?? item.enabled,
        daysBefore: Math.max(0, Math.min(30, Number(next?.daysBefore ?? item.daysBefore) || 0)),
      };
    });
    await this.prisma.systemSetting.upsert({
      where: { key: PROGRAM_KEY },
      create: { key: PROGRAM_KEY, value: clean, category: 'notifications' },
      update: { value: clean },
    });
    await this.audit.log({ adminUserId, action: 'notification.program', resource: 'notification' });
    return { templates: clean };
  }

  async sendProgram(adminUserId: string, input: { kind?: string; audience?: string; title?: string; body?: string }) {
    const program = await this.getProgram();
    const kind = input.kind || 'MARKETING';
    const template = program.templates.find((item) => item.kind === kind) ?? program.templates.find((item) => item.kind === 'MARKETING')!;
    const title = (input.title || template.title).trim();
    const body = (input.body || template.body).trim();
    const sent = await this.dispatch({
      kind,
      title,
      body,
      audience: input.audience || 'active',
      daysBefore: template.daysBefore,
      manual: true,
    });
    await this.audit.log({
      adminUserId,
      action: 'notification.program_send',
      resource: 'notification',
      metadata: { kind, sent },
    });
    return { sent };
  }

  async marketingExpert(brief: string, kind?: string) {
    const fallback = DEFAULT_TEMPLATES.find((item) => item.kind === kind) ?? DEFAULT_TEMPLATES[6]!;
    try {
      const result = await this.gateway.chat({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 500,
        json: true,
        messages: [
          {
            role: 'system',
            content: 'أنت خبير تسويق عربي لمنصة ChatLoora لإعلانات تيك توك. اكتب إشعاراً قصيراً للمشتركين. أعد JSON فقط بهذا الشكل {"title":"","body":"","advice":""}. يمكن استخدام {name} و{plan} و{days} و{amount}.',
          },
          { role: 'user', content: `نوع الإشعار: ${kind || 'MARKETING'}. المطلوب: ${brief || 'اكتب رسالة تسويقية قصيرة للتجديد'}` },
        ],
      });
      const parsed = JSON.parse(result.content) as { title?: string; body?: string; advice?: string };
      return {
        title: parsed.title || fallback.title,
        body: parsed.body || fallback.body,
        advice: parsed.advice || 'راجع النص ثم أرسله من نفس الصفحة.',
      };
    } catch (error) {
      this.logger.warn(`Marketing expert failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return {
        title: fallback.title,
        body: fallback.body,
        advice: 'تعذر الاتصال بالخبير الآن. هذا نص جاهز يمكنك تعديله ثم إرساله.',
      };
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledNotices() {
    try {
      const program = await this.getProgram();
      for (const template of program.templates) {
        if (!template.enabled || template.kind === 'MARKETING') continue;
        await this.dispatch({
          kind: template.kind,
          title: template.title,
          body: template.body,
          audience: template.kind === 'EXPIRED' ? 'expired' : template.kind === 'PAYMENT' || template.kind === 'ACTIVATED' ? 'recent_payment' : 'due',
          daysBefore: template.daysBefore,
          manual: false,
        });
      }
    } catch (error) {
      this.logger.warn(`Subscriber notices failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  private async dispatch(input: { kind: string; title: string; body: string; audience: string; daysBefore: number; manual: boolean }) {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: input.audience === 'expired'
        ? { status: SubscriptionStatus.EXPIRED }
        : input.audience === 'all'
          ? {}
          : { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      include: { plan: true, owner: true, team: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 500,
    });
    let sent = 0;
    for (const sub of subs) {
      const end = sub.currentPeriodEnd ?? sub.trialEndsAt;
      const days = end ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : null;
      if (!input.manual && input.audience === 'due' && days !== input.daysBefore) continue;
      if (!input.manual && input.audience === 'expired') {
        const expiredAt = sub.expiredAt?.getTime() ?? 0;
        if (!expiredAt || now.getTime() - expiredAt > 36 * 3600_000) continue;
      }
      if (!input.manual && input.audience === 'recent_payment') {
        const payment = sub.payments[0];
        if (!payment || payment.status !== PaymentStatus.COMPLETED || now.getTime() - payment.createdAt.getTime() > 3 * 3600_000) continue;
        if (input.kind === 'ACTIVATED' && payment.createdAt.getTime() < (sub.currentPeriodStart?.getTime() ?? payment.createdAt.getTime()) - 60_000) continue;
      }
      if (input.manual && input.audience === 'expiring' && (days == null || days < 0 || days > Math.max(input.daysBefore, 7))) continue;
      const user = sub.owner;
      if (!user) continue;
      const noticeKey = input.manual ? '' : `${input.kind}:${sub.id}:${end ? end.toISOString().slice(0, 10) : 'none'}`;
      if (noticeKey) {
        const existing = await this.prisma.platformNotification.findFirst({
          where: { userId: user.id, metadata: { path: ['noticeKey'], equals: noticeKey } },
        });
        if (existing) continue;
      }
      const amount = sub.payments[0] ? `${sub.payments[0].amountCents.toLocaleString('en-US')} ${sub.payments[0].currency}` : `${sub.plan.priceCents.toLocaleString('en-US')} ${sub.plan.currency}`;
      const title = this.fill(input.title, user.name, sub.plan.nameAr || sub.plan.name, days, amount);
      const body = this.fill(input.body, user.name, sub.plan.nameAr || sub.plan.name, days, amount);
      await this.prisma.platformNotification.create({
        data: {
          userId: user.id,
          title,
          body,
          channel: AdminNotificationChannel.IN_APP,
          sentAt: now,
          metadata: { kind: input.kind, noticeKey, subscriptionId: sub.id },
        },
      });
      await this.prisma.notification.create({
        data: { teamId: sub.teamId, userId: user.id, type: NotificationType.SYSTEM, title, body, data: { kind: input.kind } },
      });
      await this.emailUser(user.email, title, body);
      sent += 1;
    }
    return sent;
  }

  private fill(text: string, name: string, plan: string, days: number | null, amount: string) {
    return text
      .replaceAll('{name}', name)
      .replaceAll('{plan}', plan)
      .replaceAll('{days}', days == null ? '' : String(days))
      .replaceAll('{amount}', amount);
  }

  private async emailUser(to: string, title: string, body: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey || !to) return;
    try {
      const resend = new Resend(apiKey);
      const from = this.config.get<string>('RESEND_FROM_EMAIL', 'ChatLoora <onboarding@resend.dev>');
      await resend.emails.send({
        from,
        to,
        subject: title,
        html: `<div style="font-family:sans-serif;padding:24px"><h2>${title}</h2><p>${body}</p></div>`,
      });
    } catch (error) {
      this.logger.warn(`Notice email failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
