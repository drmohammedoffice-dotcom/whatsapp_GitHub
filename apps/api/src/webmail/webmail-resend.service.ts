import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Webhook } from 'svix';
import { PrismaService } from '../prisma/prisma.service';

type AttachmentMeta = {
  filename: string;
  contentType: string;
  size: number;
};

@Injectable()
export class WebmailResendService {
  private readonly logger = new Logger(WebmailResendService.name);
  private readonly resend: Resend | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  private requireResend() {
    if (!this.resend) {
      throw new ServiceUnavailableException('RESEND_API_KEY غير مضبوط');
    }
    return this.resend;
  }

  verifyWebhook(rawBody: string | Buffer, headers: Record<string, string | string[] | undefined>) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('RESEND_WEBHOOK_SECRET not set — accepting webhook without signature verify');
      return JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    }
    const wh = new Webhook(secret);
    const pick = (name: string) => {
      const v = headers[name] ?? headers[name.toLowerCase()];
      return Array.isArray(v) ? v[0] ?? '' : v ?? '';
    };
    return wh.verify(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'), {
      'svix-id': pick('svix-id'),
      'svix-timestamp': pick('svix-timestamp'),
      'svix-signature': pick('svix-signature'),
    });
  }

  async sendFromMailbox(opts: {
    mailboxId: string;
    email: string;
    displayName?: string | null;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }) {
    const resend = this.requireResend();
    const from = opts.displayName?.trim()
      ? `${opts.displayName.trim()} <${opts.email}>`
      : opts.email;

    const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
    const ccList = opts.cc ? (Array.isArray(opts.cc) ? opts.cc : [opts.cc]) : undefined;
    const bccList = opts.bcc ? (Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc]) : undefined;

    const result = await resend.emails.send({
      from,
      to: toList,
      ...(ccList?.length ? { cc: ccList } : {}),
      ...(bccList?.length ? { bcc: bccList } : {}),
      subject: opts.subject,
      ...(opts.html ? { html: opts.html } : { text: opts.text || '' }),
      ...(opts.html && opts.text ? { text: opts.text } : {}),
      replyTo: opts.email,
    } as Parameters<typeof resend.emails.send>[0]);

    if (result.error) {
      this.logger.error(`Resend send error: ${result.error.message}`);
      throw new ServiceUnavailableException(`تعذر إرسال الرسالة: ${result.error.message}`);
    }

    const preview = (opts.text || opts.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const row = await this.prisma.domainMailboxMessage.create({
      data: {
        mailboxId: opts.mailboxId,
        folder: 'Sent',
        direction: 'OUT',
        resendEmailId: result.data?.id ?? null,
        fromAddress: opts.email,
        toAddresses: toList.join(', '),
        ccAddresses: ccList?.join(', ') || null,
        bccAddresses: bccList?.join(', ') || null,
        subject: opts.subject,
        textBody: opts.text || null,
        htmlBody: opts.html || null,
        preview,
        seen: true,
        sentAt: new Date(),
      },
    });

    return { messageId: result.data?.id, message: this.toListItem(row) };
  }

  async handleInboundEvent(event: {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      message_id?: string;
      created_at?: string;
      attachments?: Array<{ filename?: string; content_type?: string; size?: number }>;
      received_for?: string[];
    };
  }) {
    if (event.type && event.type !== 'email.received') {
      return { ignored: true, type: event.type };
    }
    const emailId = event.data?.email_id;
    if (!emailId) {
      this.logger.warn('Inbound webhook missing email_id');
      return { ignored: true, reason: 'missing_email_id' };
    }

    const resend = this.requireResend();
    const { data, error } = await resend.emails.receiving.get(emailId);
    if (error || !data) {
      this.logger.error(`Failed to fetch received email ${emailId}: ${error?.message}`);
      throw new ServiceUnavailableException('تعذر جلب الرسالة الواردة من Resend');
    }

    const recipients = new Set<string>();
    for (const addr of [...(data.to ?? []), ...(data.cc ?? []), ...((data as { received_for?: string[] }).received_for ?? []), ...(event.data?.received_for ?? []), ...(event.data?.to ?? [])]) {
      const normalized = this.normalizeAddress(addr);
      if (normalized) recipients.add(normalized);
    }

    const mailboxes = await this.prisma.domainMailbox.findMany({
      where: { email: { in: [...recipients] }, isActive: true },
    });

    if (!mailboxes.length) {
      this.logger.warn(`No active mailbox for inbound ${emailId} recipients=${[...recipients].join(',')}`);
      return { stored: 0, recipients: [...recipients] };
    }

    const attachments: AttachmentMeta[] = (data.attachments ?? []).map((a) => ({
      filename: a.filename || 'attachment',
      contentType: a.content_type || 'application/octet-stream',
      size: typeof a.size === 'number' ? a.size : 0,
    }));
    const textBody = data.text || null;
    const htmlBody = typeof data.html === 'string' ? data.html : null;
    const preview = (textBody || htmlBody || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const fromAddress = this.normalizeAddress(data.from) || data.from || 'unknown';
    const toAddresses = (data.to ?? []).join(', ');
    const ccAddresses = (data.cc ?? []).join(', ') || null;
    const subject = data.subject || '(بدون عنوان)';
    const sentAt = data.created_at ? new Date(data.created_at) : new Date();

    let stored = 0;
    for (const mailbox of mailboxes) {
      try {
        await this.prisma.domainMailboxMessage.upsert({
          where: {
            mailboxId_resendEmailId: {
              mailboxId: mailbox.id,
              resendEmailId: emailId,
            },
          },
          create: {
            mailboxId: mailbox.id,
            folder: 'INBOX',
            direction: 'IN',
            resendEmailId: emailId,
            messageIdHeader: data.message_id || null,
            fromAddress,
            toAddresses: toAddresses || mailbox.email,
            ccAddresses,
            subject,
            textBody,
            htmlBody,
            preview,
            seen: false,
            hasAttachments: attachments.length > 0,
            attachmentsJson: attachments,
            sentAt,
          },
          update: {
            subject,
            textBody,
            htmlBody,
            preview,
            hasAttachments: attachments.length > 0,
            attachmentsJson: attachments,
          },
        });
        stored += 1;
      } catch (err) {
        this.logger.error(
          `Failed storing inbound for ${mailbox.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { stored, emailId, recipients: [...recipients] };
  }

  private normalizeAddress(value?: string | null) {
    if (!value) return '';
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
  }

  toListItem(row: {
    id: string;
    subject: string;
    fromAddress: string;
    toAddresses: string;
    sentAt: Date | null;
    createdAt: Date;
    seen: boolean;
    flagged: boolean;
    hasAttachments: boolean;
    preview: string;
  }) {
    return {
      id: row.id,
      uid: row.id,
      subject: row.subject || '(بدون عنوان)',
      from: row.fromAddress,
      to: row.toAddresses,
      date: (row.sentAt || row.createdAt).toISOString(),
      seen: row.seen,
      flagged: row.flagged,
      hasAttachments: row.hasAttachments,
      preview: row.preview,
    };
  }
}
