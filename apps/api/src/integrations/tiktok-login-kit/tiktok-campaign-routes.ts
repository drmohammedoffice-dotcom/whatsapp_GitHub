/**
 * مسار نشر كل هدف إعلاني في جات لورا → TikTok Marketing API.
 * فصل صارم: WEB_CONVERSIONS ≠ PRODUCT_SALES ≠ LEAD_GENERATION.
 *
 * قواعد تيك توك المعتمدة:
 * - حملة يدوية WEB_CONVERSIONS: objective_type فقط (بدون virtual_objective_type=SALES)
 * - Smart+ WEB_CONVERSIONS يتطلب sales_destination=WEBSITE ويظهر في Ads Manager كمبيعات → موقع ويب
 *   لذلك نعطّل Smart+ لتحويلات الموقع حتى لا تُخلط مع المبيعات.
 * - PRODUCT_SALES: objective_type=PRODUCT_SALES + campaign_product_source=STORE
 * - Smart+ Upgraded يدعم فقط: APP_PROMOTION | WEB_CONVERSIONS | LEAD_GENERATION
 */

export type ChatLooraObjective =
  | 'REACH'
  | 'TRAFFIC'
  | 'VIDEO_VIEWS'
  | 'ENGAGEMENT'
  | 'LEAD_GENERATION'
  | 'APP_PROMOTION'
  | 'WEB_CONVERSIONS'
  | 'PRODUCT_SALES';

export type CampaignPublishRoute = {
  objective: ChatLooraObjective;
  /** هل يُسمح بمسار smart_plus/* */
  allowsSmartPlus: boolean;
  /** endpoint إنشاء الحملة */
  campaignEndpoint: 'classic' | 'smart_plus';
  /** حقول مستوى الحملة المسموح إرسالها */
  campaignFields: {
    objective_type: ChatLooraObjective;
    /** ممنوع على WEB_CONVERSIONS اليدوية */
    virtual_objective_type?: 'SALES';
    sales_destination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE';
    campaign_product_source?: 'STORE' | 'CATALOG';
    campaign_type?: 'SEARCH';
    app_promotion_type?: 'APP_INSTALL' | 'APP_RETARGETING';
  };
  adGroupDefaults: {
    promotion_type: string;
    optimization_goal: string;
    billing_event: string;
    placement_type: 'PLACEMENT_TYPE_NORMAL' | 'PLACEMENT_TYPE_AUTOMATIC';
    placements?: string[];
    /** لا تُرسل إن كانت undefined (تفادي Invalid selection) */
    tiktok_subplacements?: string[];
    promotion_target_type?: string;
  };
  displayLabelAr: string;
};

export function resolveCampaignPublishRoute(input: {
  objective: string;
  smartPlus?: boolean;
  searchCampaign?: boolean;
  salesDestination?: string;
  appPromotionType?: string;
}): CampaignPublishRoute {
  const objective = String(input.objective || '').trim().toUpperCase() as ChatLooraObjective;
  const wantSmart = Boolean(input.smartPlus);

  switch (objective) {
    case 'REACH': {
      assertNeverSmart(wantSmart, objective);
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: {
          objective_type: 'REACH',
          ...(input.searchCampaign ? { campaign_type: 'SEARCH' as const } : {}),
        },
        adGroupDefaults: {
          promotion_type: 'WEBSITE',
          optimization_goal: 'REACH',
          billing_event: 'CPM',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'الوصول',
      };
    }
    case 'TRAFFIC': {
      assertNeverSmart(wantSmart, objective);
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: {
          objective_type: 'TRAFFIC',
          ...(input.searchCampaign ? { campaign_type: 'SEARCH' as const } : {}),
        },
        adGroupDefaults: {
          promotion_type: 'WEBSITE',
          optimization_goal: 'CLICK',
          billing_event: 'CPC',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'الزيارات',
      };
    }
    case 'VIDEO_VIEWS': {
      assertNeverSmart(wantSmart, objective);
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: { objective_type: 'VIDEO_VIEWS' },
        adGroupDefaults: {
          promotion_type: 'WEBSITE',
          optimization_goal: 'ENGAGED_VIEW',
          billing_event: 'CPV',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'مشاهدات الفيديو',
      };
    }
    case 'ENGAGEMENT': {
      assertNeverSmart(wantSmart, objective);
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: { objective_type: 'ENGAGEMENT' },
        adGroupDefaults: {
          promotion_type: 'WEBSITE',
          optimization_goal: 'FOLLOWERS',
          billing_event: 'OCPM',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'تفاعل المجتمع',
      };
    }
    case 'LEAD_GENERATION': {
      const smart = wantSmart;
      return {
        objective,
        allowsSmartPlus: true,
        campaignEndpoint: smart ? 'smart_plus' : 'classic',
        campaignFields: { objective_type: 'LEAD_GENERATION' },
        adGroupDefaults: {
          promotion_type: 'LEAD_GENERATION',
          optimization_goal: 'CONVERT',
          billing_event: 'OCPM',
          // Smart+: تلقائي. يدوي: تيك توك فقط — بدون tiktok_subplacements
          placement_type: smart ? 'PLACEMENT_TYPE_AUTOMATIC' : 'PLACEMENT_TYPE_NORMAL',
          ...(smart ? {} : { placements: ['PLACEMENT_TIKTOK'] as string[] }),
          promotion_target_type: 'EXTERNAL_WEBSITE',
        },
        displayLabelAr: smart ? 'إنشاء عميل محتمل (Smart+)' : 'إنشاء عميل محتمل',
      };
    }
    case 'APP_PROMOTION': {
      const smart = wantSmart;
      const appType = input.appPromotionType === 'APP_RETARGETING' ? 'APP_RETARGETING' : 'APP_INSTALL';
      return {
        objective,
        allowsSmartPlus: true,
        campaignEndpoint: smart ? 'smart_plus' : 'classic',
        campaignFields: {
          objective_type: 'APP_PROMOTION',
          app_promotion_type: appType,
          ...(input.searchCampaign && !smart ? { campaign_type: 'SEARCH' as const } : {}),
        },
        adGroupDefaults: {
          promotion_type: 'APP_ANDROID',
          optimization_goal: 'INSTALL',
          billing_event: 'OCPM',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: smart ? 'الترويج للتطبيق (Smart+)' : 'الترويج للتطبيق',
      };
    }
    case 'WEB_CONVERSIONS': {
      if (wantSmart) {
        // مبيعات Smart+ (مبيعات→موقع ويب) — ليس تحويلات موقع يدوية
        return {
          objective,
          allowsSmartPlus: true,
          campaignEndpoint: 'smart_plus',
          campaignFields: {
            objective_type: 'WEB_CONVERSIONS',
            sales_destination: 'WEBSITE',
          },
          adGroupDefaults: {
            promotion_type: 'WEBSITE',
            optimization_goal: 'CONVERT',
            billing_event: 'OCPM',
            placement_type: 'PLACEMENT_TYPE_NORMAL',
            placements: ['PLACEMENT_TIKTOK'],
          },
          displayLabelAr: 'مبيعات → موقع ويب (Smart+)',
        };
      }
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: {
          objective_type: 'WEB_CONVERSIONS',
          ...(input.searchCampaign ? { campaign_type: 'SEARCH' as const } : {}),
        },
        adGroupDefaults: {
          promotion_type: 'WEBSITE',
          optimization_goal: 'CONVERT',
          billing_event: 'OCPM',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'تحويلات موقع الويب',
      };
    }
    case 'PRODUCT_SALES': {
      if (wantSmart || input.salesDestination === 'WEBSITE') {
        // يُعاد توجيهه في النشر إلى WEB_CONVERSIONS Smart+
        return {
          objective: 'WEB_CONVERSIONS',
          allowsSmartPlus: true,
          campaignEndpoint: 'smart_plus',
          campaignFields: {
            objective_type: 'WEB_CONVERSIONS',
            sales_destination: 'WEBSITE',
          },
          adGroupDefaults: {
            promotion_type: 'WEBSITE',
            optimization_goal: 'CONVERT',
            billing_event: 'OCPM',
            placement_type: 'PLACEMENT_TYPE_NORMAL',
            placements: ['PLACEMENT_TIKTOK'],
          },
          displayLabelAr: 'مبيعات → موقع ويب (Smart+)',
        };
      }
      return {
        objective,
        allowsSmartPlus: false,
        campaignEndpoint: 'classic',
        campaignFields: {
          objective_type: 'PRODUCT_SALES',
          campaign_product_source: 'STORE',
        },
        adGroupDefaults: {
          promotion_type: 'PSA_PRODUCT',
          optimization_goal: 'CONVERT',
          billing_event: 'OCPM',
          placement_type: 'PLACEMENT_TYPE_NORMAL',
          placements: ['PLACEMENT_TIKTOK'],
        },
        displayLabelAr: 'مبيعات المنتجات · متجر تيك توك',
      };
    }
    default:
      throw new Error(`هدف الحملة غير مدعوم: ${input.objective}`);
  }
}

function assertNeverSmart(wantSmart: boolean, objective: string) {
  if (wantSmart) {
    throw new Error(`حملة Smart+ غير مدعومة لهدف ${objective}`);
  }
}

/** تحقق بعد البناء: لا تخلط WEB_CONVERSIONS مع حقول Sales */
export function assertCampaignBodyMatchesRoute(
  objective: string,
  body: Record<string, unknown>,
) {
  const obj = String(body.objective_type ?? '');
  if (obj !== objective) {
    throw new Error(`خطأ مسار: طُلب ${objective} لكن أُرسل objective_type=${obj}`);
  }
  if (objective === 'WEB_CONVERSIONS') {
    if (body.virtual_objective_type) {
      throw new Error('خطأ مسار: WEB_CONVERSIONS لا يجب أن تحمل virtual_objective_type');
    }
    // sales_destination مسموح فقط على مسار Smart+ (لا على classic /campaign/create)
    if (body.campaign_product_source) {
      throw new Error('خطأ مسار: WEB_CONVERSIONS لا يجب أن تحمل campaign_product_source');
    }
  }
  if (objective === 'PRODUCT_SALES') {
    if (obj !== 'PRODUCT_SALES') {
      throw new Error('خطأ مسار: مبيعات المنتجات يجب أن تكون PRODUCT_SALES');
    }
    if (body.virtual_objective_type === 'SALES' && body.sales_destination === 'WEBSITE') {
      throw new Error('خطأ مسار: PRODUCT_SALES اختلطت مع Sales/Website');
    }
  }
}
