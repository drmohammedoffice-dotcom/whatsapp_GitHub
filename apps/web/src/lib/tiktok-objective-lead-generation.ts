/** مواصفات إنشاء عميل محتمل — موقع الويب (بكسل) أو الاستمارة الفورية على تيك توك */
export const LEAD_GENERATION_OBJECTIVE_CONFIG = {
  menuId: 'LEAD_GENERATION' as const,
  apiObjective: 'LEAD_GENERATION' as const,
  labelAr: 'إنشاء عميل محتمل',
  hintAr: 'اجمع بيانات العملاء المحتملين عبر موقعك والبكسل أو عبر استمارة فورية داخل تيك توك.',
  benefitsAr: [
    'اجمع العملاء المحتملين عبر موقعك مع البكسل، أو عبر استمارة فورية داخل تيك توك.',
    'اختر موقع التحسين: موقع الويب أو الاستمارة الفورية من مكتبتك في الحساب الإعلاني.',
    'حملة يدوية فقط — تحكم كامل بالمواضع والاستهداف والإبداعات.',
  ],
  campaignModes: [
    {
      id: 'MANUAL' as const,
      titleAr: 'حملة يدوية',
      descAr: 'تحكم كامل بالمواضع والاستهداف والإبداعات والمزايدة.',
      api: { smartPlus: false },
    },
  ],
  searchCampaign: {
    labelAr: 'الحملة الإعلانية للبحث',
    badgeAr: 'جديد',
    descAr: 'استهداف الإعلانات داخل نتائج بحث تيك توك.',
    disabledWhenSmartPlus: true,
  },
  optimizationGoal: 'CONVERT' as const,
  optimizationGoalLabelAr: 'العملاء المحتملون',
  billingEvent: 'OCPM' as const,
  billingNoteAr: 'تعتمد الفوترة على الظهور (التكلفة المحسّنة لكل ألف ظهور) مع تحسين التحويل.',
  optimizationLocations: [
    {
      id: 'WEBSITE' as const,
      destination: 'PIXEL' as const,
      titleAr: 'موقع الويب',
      descAr: 'وجّه المستخدمين إلى موقعك عبر البكسل وحدث التحسين. يلزم اتصال بيانات.',
    },
    {
      id: 'INSTANT_FORM' as const,
      destination: 'INSTANT_PAGE' as const,
      titleAr: 'استمارة فورية على تيك توك',
      descAr: 'اجعل المستخدمين يملؤون استمارة مخصصة داخل تيك توك من مكتبتك.',
    },
  ],
  /** توافق خلفي — موقع التحسين الافتراضي */
  optimizationLocation: {
    id: 'WEBSITE' as const,
    titleAr: 'موقع الويب',
    descAr: 'وجّه المستخدمين إلى موقعك عبر البكسل وحدث التحسين.',
  },
  optimizationEvents: [
    { id: 'FORM', titleAr: 'إرسال النموذج (Submit Form)' },
    { id: 'SHOPPING', titleAr: 'شراء / إتمام الدفع (Purchase)' },
    { id: 'CONSULT', titleAr: 'Contact / الاتصال (واتساب)' },
    { id: 'BUTTON', titleAr: 'نقر الزر' },
    { id: 'ON_WEB_REGISTER', titleAr: 'التسجيل' },
    { id: 'ON_WEB_DETAIL', titleAr: 'عرض المحتوى' },
    { id: 'ON_WEB_CART', titleAr: 'إضافة إلى السلة' },
    { id: 'ON_WEB_SUBSCRIBE', titleAr: 'اشتراك' },
  ],
  budgetIncrease: {
    labelAr: 'زيادة الميزانية بناءً على الهدف',
    enabledLabelAr: 'مفعّل',
    descAr: 'تزيد الميزانية تلقائياً عند استهلاك 90% أو أكثر وتحقيق هدف المزايدة.',
    amountLabelAr: 'مبلغ الزيادة',
    maxTimesLabelAr: 'أقصى عدد زيادات',
    dailyCapNoteAr: 'لن يتجاوز مجموع الميزانية اليومية الحد الأقصى المحسوب من مبلغ الزيادة × عدد المرات.',
  },
  identity: {
    labelAr: 'الهوية',
    accountLabelAr: 'حساب TikTok',
    descAr: 'حدد الحساب المستخدم لإبداعات الإعلان.',
  },
  destinationAd: {
    labelAr: 'الوجهة',
    descAr: 'بناءً على موقع التحسين الذي حددته، اختر المكان الذي يتم توجيه الأشخاص إليه عند الضغط أو النقر على إعلانك.',
    websiteUrlLabelAr: 'عنوان URL لموقع الويب',
    instantFormLabelAr: 'الاستمارة الفورية',
    instantFormHintAr: 'أنشئ استمارة جديدة أو اختر استمارة موجودة من مكتبتك في تيك توك.',
    createNewAr: '+ إنشاء جديد',
    selectExistingAr: '+ اختيار الصفحة الموجودة',
  },
} as const;

export type LeadGenerationCampaignMode = (typeof LEAD_GENERATION_OBJECTIVE_CONFIG.campaignModes)[number]['id'];
export type LeadOptimizationLocationId = (typeof LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationLocations)[number]['id'];

export function defaultLeadCampaignName(date = new Date()) {
  const stamp = date.toLocaleString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `عميل محتمل ${stamp}`;
}

export function defaultCampaignName(date = new Date()) {
  const stamp = date.toLocaleString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `حملة إعلانية ${stamp}`;
}
