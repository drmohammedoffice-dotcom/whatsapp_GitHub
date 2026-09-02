import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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
    const { to, customerName, invoiceNumber, planName, billingCycle, amountCents, currency, paidAt, periodStart, periodEnd, paymentMethod } = params;

    const subject = `Your ChatLoora invoice ${invoiceNumber} — ${planName}`;
    const html = this.invoiceTemplate({
      customerName,
      invoiceNumber,
      planName,
      billingCycle,
      amountCents,
      currency,
      paidAt,
      periodStart,
      periodEnd,
      paymentMethod,
    });

    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — invoice ${invoiceNumber} for ${to} not sent`);
      return { id: 'dev-mode' };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (result.error) {
        this.logger.error(`Resend invoice error for ${to}: ${result.error.message}`);
        return { id: null, error: result.error.message };
      }

      this.logger.log(`Invoice ${invoiceNumber} sent to ${to}`);
      return result.data;
    } catch (err) {
      this.logger.error(`Failed to send invoice ${invoiceNumber} to ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { id: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private invoiceTemplate(params: {
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
  }) {
    const { customerName, invoiceNumber, planName, billingCycle, amountCents, currency, paidAt, periodStart, periodEnd, paymentMethod } = params;
    const amount = (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 0 });
    const cycleLabel = billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly';
    const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const methodLabel = paymentMethod ? this.escapeHtml(paymentMethod) : 'Online payment';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">ChatLoora</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Payment Invoice</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
            <div>
              <p style="margin:0;color:#374151;font-size:15px;font-weight:600;">${this.escapeHtml(customerName)}</p>
              <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Invoice #${this.escapeHtml(invoiceNumber)}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0;color:#6b7280;font-size:13px;">Date: ${dateFmt(paidAt)}</p>
              <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Status: <span style="color:#059669;font-weight:600;">PAID</span></p>
            </div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Description</td>
              <td style="padding:12px 16px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;text-align:right;">Amount</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:16px;color:#374151;font-size:14px;">
                <strong>${this.escapeHtml(planName)}</strong> — ${cycleLabel} subscription
                <div style="color:#6b7280;font-size:12px;margin-top:4px;">${dateFmt(periodStart)} → ${dateFmt(periodEnd)}</div>
              </td>
              <td style="padding:16px;color:#374151;font-size:14px;text-align:right;font-weight:600;">${amount}</td>
            </tr>
            <tr>
              <td style="padding:16px;color:#6b7280;font-size:13px;">Payment method</td>
              <td style="padding:16px;color:#374151;font-size:13px;text-align:right;">${methodLabel}</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="padding:16px;color:#059669;font-size:15px;font-weight:700;">Total Paid</td>
              <td style="padding:16px;color:#059669;font-size:18px;font-weight:700;text-align:right;">${amount}</td>
            </tr>
          </table>

          <div style="background:#f3f0ff;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0;color:#7c3aed;font-size:14px;font-weight:600;">✅ Your subscription is now active</p>
            <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
              Your <strong>${this.escapeHtml(planName)}</strong> plan is active until <strong>${dateFmt(periodEnd)}</strong>.
              You can manage your subscription from your dashboard.
            </p>
          </div>

          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            If you have any questions about this invoice, please contact our support team.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }
}