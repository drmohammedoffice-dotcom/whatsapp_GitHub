import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type OtpEmailType = 'signup' | 'login';

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'ChatLoora <onboarding@resend.dev>');
  }

  async sendOtpEmail(params: { to: string; code: string; type: OtpEmailType; name?: string }) {
    const { to, code, type, name } = params;
    const subject = type === 'signup' ? 'تأكيد بريدك في جات لورا' : 'رمز الدخول إلى جات لورا';
    const html = type === 'signup' ? this.signupTemplate(code, name, to) : this.loginTemplate(code, name, to);
    const text = type === 'signup' ? this.signupText(code, name, to) : this.loginText(code, name, to);

    return this.dispatch({ to, subject, html, text, logSecret: `OTP for ${to}: ${code}` });
  }

  async sendPasswordResetEmail(params: { to: string; resetUrl: string; name?: string }) {
    const { to, resetUrl, name } = params;
    const subject = 'إعادة تعيين كلمة المرور — جات لورا';
    const html = this.resetTemplate(resetUrl, name, to);
    const text = this.resetText(resetUrl, name, to);

    return this.dispatch({
      to,
      subject,
      html,
      text,
      logSecret: `Password reset link for ${to}: ${resetUrl}`,
    });
  }

  private async dispatch(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    logSecret: string;
  }) {
    const { to, subject, html, text, logSecret } = params;

    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — ${logSecret}`);
      return { id: 'dev-mode' };
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      replyTo: 'noreply@chatloora.com',
      subject,
      html,
      text,
    });

    if (result.error) {
      this.logger.error(`Resend error for ${to}: ${result.error.message}`);
      throw new ServiceUnavailableException(
        'Unable to send email. Please try again later or contact support.',
      );
    }

    return result.data;
  }

  private signupText(code: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${name}،` : 'مرحباً،';
    return [
      greeting,
      '',
      `طلب إنشاء حساب جات لورا على البريد ${to}.`,
      `رمز التأكيد: ${code}`,
      '',
      'الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة.',
      'إذا لم تطلب إنشاء الحساب، تجاهل هذه الرسالة.',
      '',
      'جات لورا',
      'https://www.chatloora.com',
    ].join('\n');
  }

  private loginText(code: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${name}،` : 'مرحباً،';
    return [
      greeting,
      '',
      `طلب تسجيل دخول إلى حساب جات لورا على البريد ${to}.`,
      `رمز الدخول: ${code}`,
      '',
      'الرمز صالح لمدة 10 دقائق.',
      'إذا لم تحاول تسجيل الدخول، غيّر كلمة المرور.',
      '',
      'جات لورا',
      'https://www.chatloora.com',
    ].join('\n');
  }

  private signupTemplate(code: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${this.escapeHtml(name)}،` : 'مرحباً،';
    return this.layout(
      'تأكيد الحساب',
      greeting,
      `طلب إنشاء حساب جات لورا على البريد <strong>${this.escapeHtml(to)}</strong>. استخدم الرمز التالي لإكمال التسجيل:`,
      code,
      'الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة. إذا لم تطلب إنشاء الحساب، تجاهل هذه الرسالة.',
    );
  }

  private loginTemplate(code: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${this.escapeHtml(name)}،` : 'مرحباً،';
    return this.layout(
      'تسجيل الدخول',
      greeting,
      `طلب تسجيل دخول إلى حساب جات لورا على البريد <strong>${this.escapeHtml(to)}</strong>. استخدم الرمز التالي للمتابعة:`,
      code,
      'الرمز صالح لمدة 10 دقائق. إذا لم تحاول تسجيل الدخول، غيّر كلمة المرور.',
    );
  }

  private resetText(resetUrl: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${name}،` : 'مرحباً،';
    return [
      greeting,
      '',
      `طلب إعادة تعيين كلمة مرور حساب جات لورا على البريد ${to}.`,
      'افتح الرابط التالي لتعيين كلمة مرور جديدة:',
      resetUrl,
      '',
      'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.',
      'إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.',
      '',
      'جات لورا',
      'https://www.chatloora.com',
    ].join('\n');
  }

  private resetTemplate(resetUrl: string, name: string | undefined, to: string) {
    const greeting = name ? `مرحباً ${this.escapeHtml(name)}،` : 'مرحباً،';
    const safeUrl = this.escapeHtml(resetUrl);
    return this.linkLayout(
      'إعادة تعيين كلمة المرور',
      greeting,
      `طلب إعادة تعيين كلمة مرور حساب جات لورا على البريد <strong>${this.escapeHtml(to)}</strong>. اضغط الزر التالي لتعيين كلمة مرور جديدة:`,
      safeUrl,
      'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة. إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.',
    );
  }

  private linkLayout(title: string, greeting: string, body: string, safeUrl: string, note: string) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:Tahoma,Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr><td align="center" style="padding:28px 28px 8px;">
          <a href="https://www.chatloora.com" style="text-decoration:none;">
            <img src="https://www.chatloora.com/chatloora-logo.png" width="168" height="102" alt="جات لورا" style="display:block;border:0;outline:none;text-decoration:none;width:168px;height:auto;" />
          </a>
          <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">${title}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 12px;">${greeting}</p>
          <p style="margin:0 0 20px;">${body}</p>
          <p style="margin:0 0 20px;text-align:center;">
            <a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">تعيين كلمة مرور جديدة</a>
          </p>
          <p style="margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all;">أو انسخ الرابط:<br/><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
          <p style="margin:0 0 16px;font-size:13px;color:#4b5563;">${note}</p>
          <p style="margin:0;font-size:13px;"><a href="https://www.chatloora.com" style="color:#4f46e5;">https://www.chatloora.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private layout(title: string, greeting: string, body: string, code: string, note: string) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:Tahoma,Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr><td align="center" style="padding:28px 28px 8px;">
          <a href="https://www.chatloora.com" style="text-decoration:none;">
            <img src="https://www.chatloora.com/chatloora-logo.png" width="168" height="102" alt="جات لورا" style="display:block;border:0;outline:none;text-decoration:none;width:168px;height:auto;" />
          </a>
          <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">${title}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 12px;">${greeting}</p>
          <p style="margin:0 0 20px;">${body}</p>
          <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:4px;text-align:center;">${code}</p>
          <p style="margin:0 0 16px;font-size:13px;color:#4b5563;">${note}</p>
          <p style="margin:0;font-size:13px;"><a href="https://www.chatloora.com" style="color:#4f46e5;">https://www.chatloora.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
