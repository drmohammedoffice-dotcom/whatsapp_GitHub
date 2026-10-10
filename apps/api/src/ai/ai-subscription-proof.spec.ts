import {
  amountMatchesPackage,
  buildSubscriptionAskPackageMessage,
  buildSubscriptionThankYouMessage,
  detectSubscriptionPackage,
  extractEmails,
  inferPackageFromAmount,
  looksLikePackageChoice,
  parseAmountNumber,
} from './ai-subscription-proof';

describe('ai-subscription-proof package + amount', () => {
  it('maps first/second/third package ordinals', () => {
    expect(detectSubscriptionPackage('أريد الباقة الأولى')?.key).toBe('basic');
    expect(detectSubscriptionPackage('الباقة الثانية')?.key).toBe('pro');
    expect(detectSubscriptionPackage('الباقة الثالثة')?.key).toBe('business');
    expect(detectSubscriptionPackage('الاحترافية')?.amountUsd).toBe(25);
  });

  it('does not confuse package ordinals with prices like 15$', () => {
    expect(detectSubscriptionPackage('حوّلت 15$ للباقة الأساسية')?.key).toBe('basic');
    expect(detectSubscriptionPackage('المبلغ 25 دولار')?.key).toBe('pro');
  });

  it('matches IQD and USD amounts to packages', () => {
    const pro = detectSubscriptionPackage('الثانية')!;
    expect(amountMatchesPackage('38000', pro)).toBe(true);
    expect(amountMatchesPackage('38,000', pro)).toBe(true);
    expect(amountMatchesPackage('25', pro)).toBe(true);
    expect(amountMatchesPackage('22800', pro)).toBe(false);
    expect(inferPackageFromAmount('22800')?.key).toBe('basic');
    expect(inferPackageFromAmount('49')?.key).toBe('business');
    expect(parseAmountNumber('38,000 IQD')).toBe(38000);
  });

  it('builds package ask and activated thank-you', () => {
    const ask = buildSubscriptionAskPackageMessage('a@b.com');
    expect(ask).toContain('الأساسية');
    expect(ask).toContain('الثانية');
    expect(looksLikePackageChoice('الباقة الثانية')).toBe(true);
    expect(extractEmails('mail me at X@Y.com')).toEqual(['x@y.com']);

    const thanks = buildSubscriptionThankYouMessage('a@b.com', detectSubscriptionPackage('الثانية'), true);
    expect(thanks).toContain('تفعيل');
    expect(thanks).toContain('الاحترافية');
  });
});
