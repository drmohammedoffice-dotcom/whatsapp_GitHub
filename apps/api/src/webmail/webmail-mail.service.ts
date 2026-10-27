import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

export type MailboxFolderSummary = {
  path: string;
  name: string;
  specialUse: string | null;
  exists: number;
  unseen: number;
};

export type MailMessageListItem = {
  uid: number;
  seq: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  preview: string;
};

export type MailMessageDetail = MailMessageListItem & {
  html: string | null;
  text: string | null;
  cc: string;
  replyTo: string;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
};

@Injectable()
export class WebmailMailService {
  private readonly logger = new Logger(WebmailMailService.name);

  constructor(private readonly config: ConfigService) {}

  private imapHost() {
    return this.config.get<string>('MAIL_IMAP_HOST', 'mail.privateemail.com');
  }

  private imapPort() {
    return this.config.get<number>('MAIL_IMAP_PORT', 993);
  }

  private smtpHost() {
    return this.config.get<string>('MAIL_SMTP_HOST', 'mail.privateemail.com');
  }

  private smtpPort() {
    return this.config.get<number>('MAIL_SMTP_PORT', 465);
  }

  private async withImap<T>(email: string, password: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = new ImapFlow({
      host: this.imapHost(),
      port: this.imapPort(),
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    try {
      await client.connect();
      return await fn(client);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'IMAP connection failed';
      this.logger.warn(`IMAP error for ${email}: ${message}`);
      throw new ServiceUnavailableException(
        `تعذر الاتصال بخادم البريد. تأكد أن الصندوق ${email} موجود في Private Email بنفس كلمة المرور. (${message})`,
      );
    } finally {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
  }

  async listFolders(email: string, password: string): Promise<MailboxFolderSummary[]> {
    return this.withImap(email, password, async (client) => {
      const boxes = await client.list();
      const summaries: MailboxFolderSummary[] = [];
      for (const box of boxes) {
        if (box.flags?.has('\\Noselect')) continue;
        let exists = 0;
        let unseen = 0;
        try {
          const status = await client.status(box.path, { messages: true, unseen: true });
          if (status) {
            exists = status.messages ?? 0;
            unseen = status.unseen ?? 0;
          }
        } catch {
          /* skip status errors */
        }
        summaries.push({
          path: box.path,
          name: box.name || box.path,
          specialUse: box.specialUse ?? null,
          exists,
          unseen,
        });
      }
      return summaries.sort((a, b) => {
        const rank = (f: MailboxFolderSummary) => {
          if (f.path.toUpperCase() === 'INBOX' || f.specialUse === '\\Inbox') return 0;
          if (f.specialUse === '\\Sent') return 1;
          if (f.specialUse === '\\Drafts') return 2;
          if (f.specialUse === '\\Junk') return 3;
          if (f.specialUse === '\\Trash') return 4;
          return 10;
        };
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
    });
  }

  async listMessages(
    email: string,
    password: string,
    folder = 'INBOX',
    page = 1,
    pageSize = 40,
  ): Promise<{ folder: string; total: number; page: number; pageSize: number; messages: MailMessageListItem[] }> {
    return this.withImap(email, password, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const total = client.mailbox && typeof client.mailbox !== 'boolean' ? client.mailbox.exists : 0;
        if (!total) {
          return { folder, total: 0, page, pageSize, messages: [] };
        }
        const end = Math.max(1, total - (page - 1) * pageSize);
        const start = Math.max(1, end - pageSize + 1);
        const range = `${start}:${end}`;
        const messages: MailMessageListItem[] = [];
        for await (const msg of client.fetch(range, {
          uid: true,
          flags: true,
          envelope: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 2048 },
        })) {
          const envelope = msg.envelope;
          const from = (envelope?.from ?? []).map((a) => a.name || a.address || '').filter(Boolean).join(', ');
          const to = (envelope?.to ?? []).map((a) => a.name || a.address || '').filter(Boolean).join(', ');
          let preview = '';
          if (msg.source) {
            try {
              const parsed = await simpleParser(msg.source);
              preview = (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
            } catch {
              preview = '';
            }
          }
          const flags = msg.flags ?? new Set<string>();
          const dateVal = envelope?.date;
          messages.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: envelope?.subject || '(بدون عنوان)',
            from,
            to,
            date: dateVal ? new Date(dateVal).toISOString() : null,
            seen: flags.has('\\Seen'),
            flagged: flags.has('\\Flagged'),
            hasAttachments: Boolean(msg.bodyStructure && 'childNodes' in msg.bodyStructure),
            preview,
          });
        }
        messages.reverse();
        return { folder, total, page, pageSize, messages };
      } finally {
        lock.release();
      }
    });
  }

  async getMessage(email: string, password: string, folder: string, uid: number): Promise<MailMessageDetail> {
    return this.withImap(email, password, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(String(uid), { uid: true, flags: true, envelope: true, source: true }, { uid: true });
        if (!msg || !msg.source) {
          throw new ServiceUnavailableException('الرسالة غير موجودة');
        }
        const parsed = await simpleParser(msg.source);
        const envelope = msg.envelope;
        const flags = msg.flags ?? new Set<string>();
        if (!flags.has('\\Seen')) {
          try {
            await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
          } catch {
            /* ignore */
          }
        }
        const addrText = (value: unknown) => {
          if (!value) return '';
          if (Array.isArray(value)) {
            return value
              .map((v) => (v && typeof v === 'object' && 'text' in v ? String((v as { text?: string }).text || '') : ''))
              .filter(Boolean)
              .join(', ');
          }
          if (typeof value === 'object' && value && 'text' in value) {
            return String((value as { text?: string }).text || '');
          }
          return '';
        };
        const dateRaw = parsed.date || envelope?.date;
        return {
          uid: msg.uid,
          seq: msg.seq,
          subject: parsed.subject || envelope?.subject || '(بدون عنوان)',
          from: addrText(parsed.from) || (envelope?.from ?? []).map((a) => a.address || '').join(', '),
          to: addrText(parsed.to) || (envelope?.to ?? []).map((a) => a.address || '').join(', '),
          cc: addrText(parsed.cc),
          replyTo: addrText(parsed.replyTo),
          date: dateRaw ? new Date(dateRaw).toISOString() : null,
          seen: true,
          flagged: flags.has('\\Flagged'),
          hasAttachments: (parsed.attachments?.length ?? 0) > 0,
          preview: (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          html: typeof parsed.html === 'string' ? parsed.html : null,
          text: parsed.text || null,
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename || 'attachment',
            contentType: a.contentType || 'application/octet-stream',
            size: a.size || 0,
          })),
        };
      } finally {
        lock.release();
      }
    });
  }

  async deleteMessage(email: string, password: string, folder: string, uid: number) {
    return this.withImap(email, password, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete({ uid }, { uid: true });
        return { ok: true };
      } finally {
        lock.release();
      }
    });
  }

  async sendMail(opts: {
    email: string;
    password: string;
    displayName?: string | null;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }) {
    const transporter = nodemailer.createTransport({
      host: this.smtpHost(),
      port: this.smtpPort(),
      secure: this.smtpPort() === 465,
      auth: { user: opts.email, pass: opts.password },
    });
    try {
      const info = await transporter.sendMail({
        from: opts.displayName ? `"${opts.displayName}" <${opts.email}>` : opts.email,
        to: opts.to,
        cc: opts.cc,
        bcc: opts.bcc,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMTP send failed';
      this.logger.warn(`SMTP error for ${opts.email}: ${message}`);
      throw new ServiceUnavailableException(
        `تعذر إرسال الرسالة. تأكد من إعدادات SMTP وأن الصندوق موجود في Private Email. (${message})`,
      );
    } finally {
      transporter.close();
    }
  }

  async verifyCredentials(email: string, password: string): Promise<boolean> {
    try {
      await this.withImap(email, password, async () => true);
      return true;
    } catch {
      return false;
    }
  }
}
