import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const SUPPORT_EMAIL = 'support@chatloora.com';

export interface InvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amountCents: number;
  currency: string;
  paidAt: Date;
  periodStart: Date;
  periodEnd: Date;
  paymentMethod?: string;
}

@Injectable()
export class BillingEmailService {
  private readonly logger = new Logger(BillingEmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'ChatLoora <onboarding@resend.dev>');
  }

  async sendInvoiceEmail(params: InvoiceEmailParams) {
    const { to, invoiceNumber, planName } = params;
    const subject = `فاتورة جات لورا رقم ${invoiceNumber} — ${planName}`;
    return this.deliver(to, subject, this.invoiceTemplate(params), `invoice ${invoiceNumber}`);
  }

  async sendRenewalEmail(params: {
    to: string;
    customerName: string;
    planName: string;
    amountLabel: string;
    payUrl: string;
    periodEnd: Date;
  }) {
    const html = this.layout({
      preheader: `موعد تجديد باقة ${params.planName}`,
      title: 'موعد تجديد اشتراكك',
      body: `<p>مرحباً ${this.escapeHtml(params.customerName)}،</p>
<p>يحين موعد تجديد باقة <strong>${this.escapeHtml(params.planName)}</strong> (${this.escapeHtml(params.amountLabel)}) بتاريخ <strong>${this.arabicDate(params.periodEnd, false)}</strong>.</p>
<p>ادفع قبل هذا التاريخ حتى تستمر روابط البكسل والحملات دون توقف. يمكنك إيقاف التجديد التلقائي من صفحة الحساب.</p>`,
      action: { label: 'تجديد الاشتراك', url: params.payUrl },
    });
    return this.deliver(params.to, `تجديد اشتراك جات لورا — ${params.planName}`, html, 'renewal');
  }

  async sendTrialStarted(params: { to: string; customerName: string; endsAt: Date; plansUrl: string }) {
    const html = this.layout({
      preheader: 'تجربتك المجانية مفعّلة لمدة 3 أيام',
      title: 'أهلاً بك في جات لورا',
      body: `<p>مرحباً ${this.escapeHtml(params.customerName)}،</p>
<p>فعّلنا لحسابك تجربة مجانية لمدة <strong>3 أيام</strong> بدون أي دفع.</p>
<p>تنتهي التجربة في <strong>${this.arabicDate(params.endsAt)}</strong>. بعدها تتوقف روابط البكسل والحملات حتى تفعّل الاشتراك، وتبقى بياناتك محفوظة.</p>`,
      action: { label: 'عرض الباقات', url: params.plansUrl },
    });
    return this.sendTrialMail(params.to, 'تم تفعيل تجربتك المجانية لمدة 3 أيام', html);
  }

  async sendTrialReminder(params: { to: string; customerName: string; endsAt: Date; plansUrl: string }) {
    const html = this.layout({
      preheader: 'تبقّى أقل من يوم على انتهاء تجربتك',
      title: 'تجربتك تنتهي قريباً',
      body: `<p>مرحباً ${this.escapeHtml(params.customerName)}،</p>
<p>تنتهي تجربتك المجانية في <strong>${this.arabicDate(params.endsAt)}</strong>.</p>
<p>فعّل الاشتراك قبل انتهاء المدة حتى تستمر روابط البكسل والحملات الإعلانية دون توقف.</p>`,
      action: { label: 'تفعيل الاشتراك', url: params.plansUrl },
    });
    return this.sendTrialMail(params.to, 'تبقّى أقل من يوم على انتهاء تجربتك المجانية', html);
  }

  async sendTrialEnded(params: { to: string; customerName: string; plansUrl: string }) {
    const html = this.layout({
      preheader: 'انتهت التجربة المجانية',
      title: 'انتهت الفترة المجانية',
      body: `<p>مرحباً ${this.escapeHtml(params.customerName)}،</p>
<p>انتهت تجربتك المجانية. روابط البكسل والحملات متوقفة حتى تفعّل الاشتراك، وبياناتك محفوظة وتعود للعمل فور التفعيل.</p>`,
      action: { label: 'تفعيل الاشتراك الآن', url: params.plansUrl },
    });
    return this.sendTrialMail(params.to, 'انتهت الفترة المجانية — فعّل الاشتراك', html);
  }

  private invoiceTemplate(params: InvoiceEmailParams) {
    const { customerName, invoiceNumber, planName, billingCycle, amountCents, currency, paidAt, periodStart, periodEnd, paymentMethod } = params;
    const amount =
      currency === 'IQD'
        ? `${amountCents.toLocaleString('ar-IQ')} د.ع`
        : (amountCents / 100).toLocaleString('ar-IQ', { style: 'currency', currency, minimumFractionDigits: 0 });
    const cycleLabel = billingCycle === 'YEARLY' ? 'سنوي' : 'شهري';
    const method = paymentMethod ? this.escapeHtml(paymentMethod) : 'دفع إلكتروني';
    const row = (label: string, value: string, strong = false) =>
      `<tr><td style="padding:12px 0;color:#6B6880;font-size:14px;border-bottom:1px solid #E7E4F0;">${label}</td>` +
      `<td style="padding:12px 0;color:#0F0A1F;font-size:14px;border-bottom:1px solid #E7E4F0;text-align:left;${strong ? 'font-weight:700;' : ''}">${value}</td></tr>`;
    return this.layout({
      preheader: `فاتورة رقم ${invoiceNumber} — تم الدفع`,
      title: 'تم استلام دفعتك ✅',
      body: `<p>مرحباً ${this.escapeHtml(customerName)}،</p>
<p>شكراً لك. اشتراكك في باقة <strong>${this.escapeHtml(planName)}</strong> فعّال حتى <strong>${this.arabicDate(periodEnd, false)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
${row('رقم الفاتورة', this.escapeHtml(invoiceNumber))}
${row('تاريخ الدفع', this.arabicDate(paidAt, false))}
${row('الباقة', `${this.escapeHtml(planName)} — ${cycleLabel}`)}
${row('مدة الاشتراك', `${this.arabicDate(periodStart, false)} ← ${this.arabicDate(periodEnd, false)}`)}
${row('طريقة الدفع', method)}
${row('المبلغ المدفوع', amount, true)}
</table>
<p style="color:#6B6880;font-size:13px;">احتفظ بهذه الرسالة كإيصال. لأي استفسار عن الفاتورة راسلنا على ${SUPPORT_EMAIL}.</p>`,
    });
  }

  /** Shared Arabic RTL email layout in the brand colours (inline styles for mail clients). */
  private layout(input: { preheader: string; title: string; body: string; action?: { label: string; url: string } }) {
    const button = input.action
      ? `<p style="margin:28px 0 8px;text-align:center;"><a href="${this.escapeHtml(input.action.url)}" style="display:inline-block;background:#7C3AED;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;">${this.escapeHtml(input.action.label)}</a></p>`
      : '';
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F8F7FC;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl;text-align:right;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${this.escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E7E4F0;">
<tr><td style="background:#7C3AED;background-image:linear-gradient(135deg,#7C3AED,#22D3EE);padding:24px 28px;color:#ffffff;">
<div style="font-size:20px;font-weight:700;">جات لورا · ChatLoora</div>
<div style="font-size:13px;opacity:.9;margin-top:4px;">إعلانات تيك توك وتتبع واتساب</div>
</td></tr>
<tr><td style="padding:28px;color:#0F0A1F;font-size:15px;line-height:1.8;">
<h1 style="margin:0 0 16px;font-size:20px;color:#0F0A1F;">${this.escapeHtml(input.title)}</h1>
${input.body}
${button}
</td></tr>
<tr><td style="padding:18px 28px;background:#F8F7FC;color:#6B6880;font-size:12px;line-height:1.7;">
وصلتك هذه الرسالة لأن لديك حساباً في جات لورا. للمساعدة: ${SUPPORT_EMAIL}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  /** Arabic date in Baghdad time (the server runs in UTC). */
  private arabicDate(value: Date, withTime = true) {
    return value.toLocaleString('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }

  private async deliver(to: string, subject: string, html: string, label: string) {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — ${label} email for ${to} not sent`);
      return { id: 'dev-mode' };
    }
    try {
      const result = await this.resend.emails.send({ from: this.fromEmail, to, subject, html });
      if (result.error) {
        this.logger.error(`Resend ${label} error for ${to}: ${result.error.message}`);
        return { id: null, error: result.error.message };
      }
      this.logger.log(`${label} email sent to ${to}`);
      return result.data;
    } catch (err) {
      this.logger.error(`${label} email failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { id: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async sendTrialMail(to: string, subject: string, html: string) {
    const result = await this.deliver(to, subject, html, 'trial');
    return Boolean(result && 'id' in result && result.id && result.id !== 'dev-mode');
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}