import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class SalesPartnerEmailService {
  private readonly logger = new Logger(SalesPartnerEmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'ChatLoora <onboarding@resend.dev>');
  }

  async sendPayoutCode(params: { to: string; name: string; code: string; amountLabel: string }) {
    const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f4f4f8;padding:24px;">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:24px;color:#fff;">
      <h1 style="margin:0;font-size:20px;">ChatLoora</h1>
      <p style="margin:8px 0 0;">تأكيد طلب سحب الأرباح</p>
    </div>
    <div style="padding:24px;color:#374151;">
      <p>مرحباً ${this.escape(params.name)}،</p>
      <p>رمز تأكيد سحب <strong>${this.escape(params.amountLabel)}</strong>:</p>
      <p style="font-size:32px;letter-spacing:8px;text-align:center;color:#7c3aed;font-weight:700;">${this.escape(params.code)}</p>
      <p style="color:#6b7280;font-size:13px;">ينتهي خلال 10 دقائق. إذا لم تطلب السحب فتجاهل الرسالة.</p>
    </div>
  </div>
</body></html>`;
    return this.send(params.to, 'تأكيد طلب سحب أرباح ChatLoora', html, params.code);
  }

  async sendPayoutPaid(params: { to: string; name: string; amountLabel: string }) {
    const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f4f4f8;padding:24px;">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:24px;color:#374151;">
    <h1 style="color:#7c3aed;">ChatLoora</h1>
    <p>مرحباً ${this.escape(params.name)}،</p>
    <p>تم دفع طلب سحب الأرباح بقيمة <strong>${this.escape(params.amountLabel)}</strong>.</p>
    <p>يمكنك مراجعة صورة فاتورة الدفع من لوحة الشريك.</p>
  </div>
</body></html>`;
    return this.send(params.to, 'تم دفع أرباحك — ChatLoora', html);
  }

  async sendJoinCode(params: { to: string; name: string; code: string }) {
    const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f4f4f8;padding:24px;">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:24px;color:#fff;">
      <h1 style="margin:0;font-size:20px;">ChatLoora</h1>
      <p style="margin:8px 0 0;">تأكيد البريد لبرنامج كن شريكنا بالنجاح</p>
    </div>
    <div style="padding:24px;color:#374151;">
      <p>مرحباً ${this.escape(params.name)}،</p>
      <p>رمز تأكيد بريدك:</p>
      <p style="font-size:32px;letter-spacing:8px;text-align:center;color:#7c3aed;font-weight:700;">${this.escape(params.code)}</p>
      <p style="color:#6b7280;font-size:13px;">ينتهي خلال 15 دقيقة.</p>
    </div>
  </div>
</body></html>`;
    return this.send(params.to, 'رمز تأكيد كن شريكنا بالنجاح', html, params.code);
  }

  private async send(to: string, subject: string, html: string, fallbackCode?: string) {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — email ${subject} to ${to}${fallbackCode ? ` code=${fallbackCode}` : ''}`);
      return { id: 'dev-mode' };
    }
    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      text: fallbackCode
        ? `رمز تأكيد سحب الأرباح: ${fallbackCode}`
        : subject,
    });
    if (result.error) {
      this.logger.error(`Resend error for ${to}: ${result.error.message}`);
      throw new ServiceUnavailableException('تعذر إرسال البريد. حاول لاحقاً.');
    }
    this.logger.log(`Email sent subject="${subject}" to=${to} id=${result.data?.id ?? 'unknown'}`);
    return result.data;
  }

  private escape(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
