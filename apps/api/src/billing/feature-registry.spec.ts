import {
  canCreateWithLimit,
  entitlementsFromLimits,
  isOverLimit,
  limitsFromEntitlements,
  seedLimitsForSlug,
} from './feature-registry';

describe('plan entitlements registry', () => {
  it('seeds Basic limits for $15 package', () => {
    const basic = seedLimitsForSlug('basic');
    expect(basic.maxWhatsappNumbers).toBe(1);
    expect(basic.maxPixels).toBe(3);
    expect(basic.maxTiktokPixels).toBe(3);
    expect(basic.whatsappApiEnabled).toBe(false);
    expect(basic.instantFormsEnabled).toBe(false);
    expect(basic.onlineStoreEnabled).toBe(false);
    expect(basic.aiCampaignReviewEnabled).toBe(false);
    expect(basic.aiEnabled).toBe(false);
    expect(canCreateWithLimit(1, basic.maxWhatsappNumbers)).toBe(false);
    expect(canCreateWithLimit(0, basic.maxPixels)).toBe(true);
  });

  it('seeds Professional limits for $25 package', () => {
    const pro = seedLimitsForSlug('professional');
    expect(pro.maxWhatsappNumbers).toBe(3);
    expect(pro.maxTiktokPixels).toBe(10);
    expect(pro.whatsappApiEnabled).toBe(true);
    expect(pro.instantFormsEnabled).toBe(true);
    expect(pro.onlineStoreEnabled).toBe(false);
    expect(pro.aiCampaignReviewEnabled).toBe(false);
    expect(pro.aiEnabled).toBe(false);
    expect(canCreateWithLimit(2, pro.maxWhatsappNumbers)).toBe(true);
    expect(canCreateWithLimit(3, pro.maxWhatsappNumbers)).toBe(false);
  });

  it('seeds Business limits for $35 preferred package', () => {
    const business = seedLimitsForSlug('business');
    expect(business.maxWhatsappNumbers).toBe(5);
    expect(business.maxTiktokPixels).toBe(20);
    expect(business.maxTeamMembers).toBe(10);
    expect(business.instantFormsEnabled).toBe(true);
    expect(business.onlineStoreEnabled).toBe(true);
    expect(business.aiCampaignReviewEnabled).toBe(true);
    expect(business.aiEnabled).toBe(true);
  });

  it('uses database entitlements instead of slug when admin changes limits', () => {
    const fallback = seedLimitsForSlug('basic');
    const limits = limitsFromEntitlements(
      [
        { featureKey: 'whatsapp_enabled', enabled: true, limitValue: null },
        { featureKey: 'maximum_whatsapp_numbers', enabled: true, limitValue: 3 },
        { featureKey: 'ai_reply_enabled', enabled: true, limitValue: null },
        { featureKey: 'instagram_integration_enabled', enabled: true, limitValue: null },
        { featureKey: 'instant_forms_enabled', enabled: true, limitValue: null },
      ],
      fallback,
    );
    expect(limits.maxWhatsappNumbers).toBe(3);
    expect(limits.aiEnabled).toBe(true);
    expect(limits.instagramEnabled).toBe(true);
    expect(limits.instantFormsEnabled).toBe(true);
    expect(canCreateWithLimit(2, limits.maxWhatsappNumbers)).toBe(true);
    expect(canCreateWithLimit(3, limits.maxWhatsappNumbers)).toBe(false);
  });

  it('treats -1 as unlimited and 0 as disabled', () => {
    expect(canCreateWithLimit(100, -1)).toBe(true);
    expect(isOverLimit(100, -1)).toBe(false);
    expect(canCreateWithLimit(0, 0)).toBe(false);
    expect(isOverLimit(5, 1)).toBe(true);
    expect(isOverLimit(1, 1)).toBe(false);
  });

  it('keeps existing resources over-limit after a downgrade without deleting them', () => {
    const afterDowngrade = limitsFromEntitlements(
      entitlementsFromLimits(seedLimitsForSlug('basic')),
      seedLimitsForSlug('professional'),
    );
    expect(afterDowngrade.maxWhatsappNumbers).toBe(1);
    expect(isOverLimit(5, afterDowngrade.maxWhatsappNumbers)).toBe(true);
    expect(canCreateWithLimit(5, afterDowngrade.maxWhatsappNumbers)).toBe(false);
  });

  it('exposes voice AI as a boolean plan entitlement', () => {
    const business = seedLimitsForSlug('business');
    expect(business.voiceAiEnabled).toBe(true);
    expect(business.voiceCallsLimit).toBe(-1);
    const basic = limitsFromEntitlements(
      [{ featureKey: 'voice_ai_enabled', enabled: false, limitValue: null }],
      business,
    );
    expect(basic.voiceAiEnabled).toBe(false);
  });

  it('exposes Creative Studio plan entitlements', () => {
    const business = seedLimitsForSlug('business');
    expect(business.creativeStudioEnabled).toBe(true);
    expect(business.creativeImagesLimit).toBe(-1);
    expect(business.creative4kEnabled).toBe(true);
    const basic = limitsFromEntitlements(
      [{ featureKey: 'creative_studio_enabled', enabled: false, limitValue: null }],
      business,
    );
    expect(basic.creativeStudioEnabled).toBe(false);
  });

  it('disables a boolean feature without depending on plan slug', () => {
    const limits = limitsFromEntitlements(
      [{ featureKey: 'whatsapp_api_enabled', enabled: false, limitValue: null }],
      seedLimitsForSlug('professional'),
    );
    expect(limits.whatsappApiEnabled).toBe(false);
  });
});
