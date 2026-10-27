import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRole, TeamRole } from '@watsapp/database';
import { isEmployeeRole } from '../admin/staff-roles';
import { FreeTrialService } from '../billing/free-trial.service';
import { EncryptionService } from '../security/encryption.service';
import { PasswordService } from '../security/password.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  customerLocalPart,
  generateLocalPart,
  generateStrongPassword,
  nextCustomerSequence,
  normalizeLocalPart,
} from './webmail-crypto.util';
import { WebmailResendService } from './webmail-resend.service';

export type WebmailJwtPayload = {
  sub: string;
  email: string;
  scope: 'webmail';
};

@Injectable()
export class WebmailService {
  private readonly logger = new Logger(WebmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly encryption: EncryptionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly resendMail: WebmailResendService,
    private readonly freeTrial: FreeTrialService,
  ) {}

  domain() {
    return (this.config.get<string>('MAIL_DOMAIN', 'chatloora.com') || 'chatloora.com').toLowerCase();
  }

  private encryptPassword(password: string) {
    return this.encryption.encryptJson({ password });
  }

  private decryptPassword(payload: string): string {
    const data = this.encryption.decryptJson<{ password: string }>(payload);
    return data.password;
  }

  private publicMailbox(row: {
    id: string;
    localPart: string;
    email: string;
    displayName: string | null;
    isActive: boolean;
    notes: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdByAdminId: string | null;
  }) {
    return {
      id: row.id,
      localPart: row.localPart,
      email: row.email,
      displayName: row.displayName,
      isActive: row.isActive,
      notes: row.notes,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByAdminId: row.createdByAdminId,
      webmailUrl: `/mail`,
      setupHint:
        'الإرسال والاستقبال عبر Resend. بعد تفعيل Receiving وتحويل MX إلى Resend يعمل الصندوق تلقائياً بدون Namecheap.',
    };
  }

  /** أدمن أعلى يرى الكل؛ الموظف يرى فقط الصناديق التي أنشأها بنفسه. */
  private staffMustOwnMailboxes(roles: AdminRole[] | undefined, primaryRole?: AdminRole) {
    const list = roles?.length ? roles : primaryRole ? [primaryRole] : [];
    const isElevated =
      list.includes(AdminRole.SUPER_ADMIN) || list.includes(AdminRole.SUPPORT_AGENT);
    if (isElevated) return false;
    return list.some((r) => isEmployeeRole(r));
  }

  async assertMailboxAccess(
    mailboxId: string,
    admin: { adminUserId: string; roles?: AdminRole[]; role?: AdminRole },
  ) {
    const row = await this.prisma.domainMailbox.findUnique({ where: { id: mailboxId } });
    if (!row) throw new NotFoundException('الصندوق غير موجود');
    if (this.staffMustOwnMailboxes(admin.roles, admin.role)) {
      if (row.createdByAdminId !== admin.adminUserId) {
        throw new ForbiddenException('لا يمكنك الوصول إلى صناديق موظفين آخرين');
      }
    }
    return row;
  }

  async listMailboxes(
    q?: string,
    viewer?: { adminUserId: string; roles?: AdminRole[]; role?: AdminRole },
  ) {
    const search = q?.trim()
      ? {
          OR: [
            { email: { contains: q.trim(), mode: 'insensitive' as const } },
            { localPart: { contains: q.trim(), mode: 'insensitive' as const } },
            { displayName: { contains: q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};
    const ownership =
      viewer && this.staffMustOwnMailboxes(viewer.roles, viewer.role)
        ? { createdByAdminId: viewer.adminUserId }
        : {};
    const rows = await this.prisma.domainMailbox.findMany({
      where: { ...search, ...ownership },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => this.publicMailbox(row));
  }

  /** Next free local-part: customer1, customer2, … across mailboxes + platform users. */
  async allocateNextCustomerLocalPart(): Promise<string> {
    const domain = this.domain();
    const [mailboxes, users] = await Promise.all([
      this.prisma.domainMailbox.findMany({
        where: { localPart: { startsWith: 'customer' } },
        select: { localPart: true },
      }),
      this.prisma.user.findMany({
        where: { email: { startsWith: 'customer', endsWith: `@${domain}` } },
        select: { email: true },
      }),
    ]);
    const locals = [
      ...mailboxes.map((m) => m.localPart),
      ...users.map((u) => u.email),
    ];
    let n = nextCustomerSequence(locals);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const localPart = customerLocalPart(n);
      const email = `${localPart}@${domain}`;
      const [mb, user] = await Promise.all([
        this.prisma.domainMailbox.findFirst({ where: { OR: [{ localPart }, { email }] } }),
        this.prisma.user.findUnique({ where: { email } }),
      ]);
      if (!mb && !user) return localPart;
      n += 1;
    }
    throw new ConflictException('تعذر تخصيص رقم عميل متسلسل — أعد المحاولة');
  }

  /**
   * One-click provision: customerN@domain mailbox + Chatloora subscriber + 3-day full-access trial.
   * Email is marked verified so login OTP is not required.
   */
  async createCustomerMailboxProvisioned(input: {
    displayName: string;
    notes?: string;
    adminId?: string;
  }) {
    const name = input.displayName?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException('أدخل اسم المستخدم أولاً');
    }

    const domain = this.domain();
    const localPart = await this.allocateNextCustomerLocalPart();
    const password = generateStrongPassword(20);
    const email = `${localPart}@${domain}`;
    const passwordHash = await this.passwords.hash(password);
    const passwordEncrypted = this.encryptPassword(password);
    const noteParts = [
      input.notes?.trim(),
      'provisioned_subscriber',
      'trial_3d_full_access',
      'email_verified_skip_otp',
    ].filter(Boolean);

    const mailbox = await this.prisma.domainMailbox.create({
      data: {
        localPart,
        email,
        displayName: name,
        notes: noteParts.join(' | '),
        passwordHash,
        passwordEncrypted,
        createdByAdminId: input.adminId ?? null,
      },
    });

    const slugBase = `customer-${localPart.replace(/\D/g, '') || Date.now()}`;
    let slug = slugBase;
    let counter = 1;
    while (await this.prisma.team.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${counter++}`;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
        teamMembers: {
          create: {
            role: TeamRole.OWNER,
            team: { create: { name: name.slice(0, 80), slug } },
          },
        },
      },
      include: { teamMembers: { include: { team: true } } },
    });

    const teamId = user.teamMembers[0]?.teamId;
    let trialEndsAt: string | null = null;
    let planSlug: string | null = null;
    if (teamId) {
      try {
        const sub = await this.freeTrial.grant({
          teamId,
          userId: user.id,
          email,
          name,
          fullAccess: true,
          skipWelcomeEmail: true,
        });
        trialEndsAt = sub?.trialEndsAt?.toISOString() ?? null;
        if (sub?.planId) {
          const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: sub.planId },
            select: { slug: true },
          });
          planSlug = plan?.slug ?? null;
        }
      } catch (err) {
        this.logger.error(
          `Mailbox provisioned but trial failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      mailbox: this.publicMailbox(mailbox),
      credentials: {
        email,
        password,
        webmailUrl: '/mail',
        platformLoginUrl: '/login',
      },
      subscriber: {
        userId: user.id,
        teamId: teamId ?? null,
        email,
        name,
        emailVerified: true,
        trialDays: 3,
        trialEndsAt,
        planSlug,
        fullAccess: true,
      },
    };
  }

  async createMailbox(input: {
    localPart?: string;
    password?: string;
    displayName?: string;
    notes?: string;
    autoGenerate?: boolean;
    adminId?: string;
  }) {
    const domain = this.domain();
    let localPart = input.autoGenerate || !input.localPart?.trim()
      ? generateLocalPart(10)
      : normalizeLocalPart(input.localPart);

    if (!localPart || localPart.length < 2) {
      throw new BadRequestException('اسم الصندوق غير صالح');
    }

    let attempts = 0;
    while (attempts < 8) {
      const exists = await this.prisma.domainMailbox.findFirst({
        where: { OR: [{ localPart }, { email: `${localPart}@${domain}` }] },
      });
      if (!exists) break;
      if (!input.autoGenerate && input.localPart?.trim()) {
        throw new ConflictException(`الصندوق ${localPart}@${domain} موجود مسبقاً`);
      }
      localPart = generateLocalPart(10);
      attempts += 1;
    }

    const password =
      input.autoGenerate || !input.password?.trim()
        ? generateStrongPassword(20)
        : input.password.trim();

    if (password.length < 10) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 10 أحرف على الأقل');
    }

    const email = `${localPart}@${domain}`;
    const passwordHash = await this.passwords.hash(password);
    const passwordEncrypted = this.encryptPassword(password);

    const row = await this.prisma.domainMailbox.create({
      data: {
        localPart,
        email,
        displayName: input.displayName?.trim() || null,
        notes: input.notes?.trim() || null,
        passwordHash,
        passwordEncrypted,
        createdByAdminId: input.adminId ?? null,
      },
    });

    return {
      mailbox: this.publicMailbox(row),
      credentials: {
        email,
        password,
        webmailUrl: '/mail',
      },
    };
  }

  async updateMailbox(
    id: string,
    input: {
      displayName?: string | null;
      notes?: string | null;
      isActive?: boolean;
      password?: string;
      rotatePassword?: boolean;
    },
  ) {
    const row = await this.prisma.domainMailbox.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('الصندوق غير موجود');

    let passwordHash = row.passwordHash;
    let passwordEncrypted = row.passwordEncrypted;
    let plainPassword: string | undefined;

    if (input.rotatePassword || input.password?.trim()) {
      plainPassword = input.rotatePassword ? generateStrongPassword(20) : input.password!.trim();
      if (plainPassword.length < 10) {
        throw new BadRequestException('كلمة المرور يجب أن تكون 10 أحرف على الأقل');
      }
      passwordHash = await this.passwords.hash(plainPassword);
      passwordEncrypted = this.encryptPassword(plainPassword);
    }

    const updated = await this.prisma.domainMailbox.update({
      where: { id },
      data: {
        displayName: input.displayName === undefined ? undefined : input.displayName?.trim() || null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        isActive: input.isActive,
        passwordHash,
        passwordEncrypted,
      },
    });

    return {
      mailbox: this.publicMailbox(updated),
      credentials: plainPassword
        ? { email: updated.email, password: plainPassword, webmailUrl: '/mail' }
        : undefined,
    };
  }

  async deleteMailbox(id: string) {
    const row = await this.prisma.domainMailbox.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('الصندوق غير موجود');
    await this.prisma.domainMailbox.delete({ where: { id } });
    return { ok: true, email: row.email };
  }

  async revealPassword(id: string) {
    const row = await this.prisma.domainMailbox.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('الصندوق غير موجود');
    return {
      email: row.email,
      password: this.decryptPassword(row.passwordEncrypted),
      webmailUrl: '/mail',
    };
  }

  private async issueMailboxToken(row: { id: string; email: string; displayName: string | null }) {
    const ttl = this.config.get<string>('MAIL_WEBMAIL_JWT_TTL', '12h');
    const accessToken = await this.jwt.signAsync(
      { sub: row.id, email: row.email, scope: 'webmail' } satisfies WebmailJwtPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ttl as any,
      },
    );
    return {
      accessToken,
      mailbox: {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
      },
    };
  }

  async login(emailRaw: string, password: string) {
    const email = emailRaw.trim().toLowerCase();
    const row = await this.prisma.domainMailbox.findUnique({ where: { email } });
    if (!row || !row.isActive) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    const ok = await this.passwords.verify(password, row.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.prisma.domainMailbox.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueMailboxToken(row);
  }

  /** جلسة ويب ميل مباشرة للأدمن / منشئ الحسابات بدون كلمة مرور */
  async openSession(mailboxId: string) {
    const row = await this.prisma.domainMailbox.findUnique({ where: { id: mailboxId } });
    if (!row || !row.isActive) throw new NotFoundException('الصندوق غير موجود');
    await this.prisma.domainMailbox.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueMailboxToken(row);
  }

  async resolveMailboxFromToken(payload: WebmailJwtPayload) {
    if (payload.scope !== 'webmail') {
      throw new UnauthorizedException('رمز غير صالح');
    }
    const row = await this.prisma.domainMailbox.findUnique({ where: { id: payload.sub } });
    if (!row || !row.isActive || row.email !== payload.email) {
      throw new UnauthorizedException('الصندوق غير متاح');
    }
    return {
      row,
      password: this.decryptPassword(row.passwordEncrypted),
    };
  }

  async me(payload: WebmailJwtPayload) {
    const { row } = await this.resolveMailboxFromToken(payload);
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      domain: this.domain(),
    };
  }

  async folders(payload: WebmailJwtPayload) {
    const { row } = await this.resolveMailboxFromToken(payload);
    const groups = await this.prisma.domainMailboxMessage.groupBy({
      by: ['folder'],
      where: { mailboxId: row.id },
      _count: { _all: true },
    });
    const unseen = await this.prisma.domainMailboxMessage.groupBy({
      by: ['folder'],
      where: { mailboxId: row.id, seen: false, folder: 'INBOX' },
      _count: { _all: true },
    });
    const countMap = new Map(groups.map((g) => [g.folder, g._count._all]));
    const unseenInbox = unseen.find((g) => g.folder === 'INBOX')?._count._all ?? 0;
    const defs = [
      { path: 'INBOX', name: 'الوارد', specialUse: '\\Inbox' },
      { path: 'Sent', name: 'المرسل', specialUse: '\\Sent' },
      { path: 'Trash', name: 'المحذوفات', specialUse: '\\Trash' },
    ];
    return defs.map((d) => ({
      ...d,
      exists: countMap.get(d.path) ?? 0,
      unseen: d.path === 'INBOX' ? unseenInbox : 0,
    }));
  }

  async messages(payload: WebmailJwtPayload, folder?: string, page?: number, pageSize?: number) {
    const { row } = await this.resolveMailboxFromToken(payload);
    const folderName = folder || 'INBOX';
    const take = Math.min(Math.max(pageSize || 40, 1), 100);
    const skip = Math.max(((page || 1) - 1) * take, 0);
    const where = { mailboxId: row.id, folder: folderName };
    const [total, rows] = await Promise.all([
      this.prisma.domainMailboxMessage.count({ where }),
      this.prisma.domainMailboxMessage.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return {
      folder: folderName,
      total,
      page: page || 1,
      pageSize: take,
      messages: rows.map((r) => this.resendMail.toListItem(r)),
    };
  }

  async message(payload: WebmailJwtPayload, _folder: string, id: string) {
    const { row } = await this.resolveMailboxFromToken(payload);
    const msg = await this.prisma.domainMailboxMessage.findFirst({
      where: { id, mailboxId: row.id },
    });
    if (!msg) throw new NotFoundException('الرسالة غير موجودة');
    if (!msg.seen) {
      await this.prisma.domainMailboxMessage.update({
        where: { id: msg.id },
        data: { seen: true },
      });
    }
    const attachments = Array.isArray(msg.attachmentsJson)
      ? (msg.attachmentsJson as Array<{ filename: string; contentType: string; size: number }>)
      : [];
    return {
      ...this.resendMail.toListItem({ ...msg, seen: true }),
      cc: msg.ccAddresses || '',
      replyTo: '',
      html: msg.htmlBody,
      text: msg.textBody,
      attachments,
    };
  }

  async deleteMessage(payload: WebmailJwtPayload, _folder: string, id: string) {
    const { row } = await this.resolveMailboxFromToken(payload);
    const msg = await this.prisma.domainMailboxMessage.findFirst({
      where: { id, mailboxId: row.id },
    });
    if (!msg) throw new NotFoundException('الرسالة غير موجودة');
    if (msg.folder === 'Trash') {
      await this.prisma.domainMailboxMessage.delete({ where: { id: msg.id } });
    } else {
      await this.prisma.domainMailboxMessage.update({
        where: { id: msg.id },
        data: { folder: 'Trash' },
      });
    }
    return { ok: true };
  }

  async send(
    payload: WebmailJwtPayload,
    body: { to: string; cc?: string; bcc?: string; subject: string; text?: string; html?: string },
  ) {
    if (!body.to?.trim()) throw new BadRequestException('المستلم مطلوب');
    if (!body.subject?.trim()) throw new BadRequestException('الموضوع مطلوب');
    if (!body.text?.trim() && !body.html?.trim()) {
      throw new BadRequestException('نص الرسالة مطلوب');
    }
    const { row } = await this.resolveMailboxFromToken(payload);
    return this.resendMail.sendFromMailbox({
      mailboxId: row.id,
      email: row.email,
      displayName: row.displayName,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
  }
}
