import type { Locale } from './types';

const landingEn = {
  nav: {
    home: 'Home',
    features: 'Features',
    solutions: 'TikTok only',
    howItWorks: 'How it Works',
    pricing: 'Pricing',
    testimonials: 'Testimonials',
    faq: 'FAQ',
    contact: 'Contact',
    login: 'Login',
    startTrial: 'Start Free Trial',
    becomePartner: 'Become a Partner',
    menu: 'Menu',
  },
  hero: {
    badge: 'TikTok ads from ChatLoora',
    titleLine1: 'Run your ads on TikTok only.',
    titleLine2: 'From your phone.',
    subtitle:
      'Link WhatsApp numbers and pixels, create campaigns, and top up ad accounts inside ChatLoora. Ads publish on TikTok alone — without the extra platforms that stay locked beside TikTok in Ads Manager.',
    ctaPrimary: 'Start Free Trial',
    ctaSecondary: 'See How It Works',
    downloadWindows: 'Download ChatLoora for Windows',
    downloadWindowsHint: 'Windows installer (.exe) — run to install',
    trusted: 'Trusted by Businesses',
    stars: 'Rated 5.0 by growing teams',
  },
  audience: {
    eyebrow: 'Who it’s for',
    title: 'Built for teams that live in customer chats',
    subtitle: 'From clinics to ecommerce — ChatLoora adapts to how you sell and support.',
    items: [
      { title: 'E-commerce', desc: 'Answer product questions and close orders faster.' },
      { title: 'Clinics', desc: 'Book, reschedule, and guide patients 24/7.' },
      { title: 'Medical Centers', desc: 'Route urgent cases and manage appointments.' },
      { title: 'Restaurants', desc: 'Handle reservations, menus, and delivery chats.' },
      { title: 'Real Estate', desc: 'Qualify leads and schedule property tours.' },
      { title: 'Agencies', desc: 'Run client WhatsApp + ads ops in one place.' },
      { title: 'Education', desc: 'Enroll students and answer course questions.' },
      { title: 'Beauty Clinics', desc: 'Book treatments and follow up automatically.' },
      { title: 'Support Teams', desc: 'Unify channels and hand off with context.' },
      { title: 'Sales Teams', desc: 'Qualify, upsell, and never miss a hot lead.' },
    ],
  },
  problems: {
    eyebrow: 'The problem',
    title: 'TikTok Ads Manager locks other platforms beside TikTok',
    subtitle: 'When you create a normal ad, other networks appear next to TikTok and cannot be removed. Views get counted outside TikTok.',
    items: [
      'Other platforms sit beside TikTok',
      'They cannot be removed',
      'Views are counted on those networks',
      'You must open TikTok Ads Manager',
    ],
    solutionTitle: 'ChatLoora publishes on TikTok only',
    solutionSubtitle:
      'Create the campaign inside ChatLoora and it goes to TikTok alone. Link WhatsApp, create pixels, launch ads, top up the balance, and manage it all from your phone.',
  },
  features: {
    eyebrow: 'What you get',
    title: 'The tools in your ChatLoora panel',
    subtitle: 'WhatsApp numbers, pixels, TikTok campaigns, and ad-account top-ups — managed from the site, including on your phone.',
    items: [
      {
        title: 'WhatsApp numbers',
        desc: 'Link the WhatsApp number that receives people who tap your ad.',
      },
      {
        title: 'Tracking pixels',
        desc: 'Create pixels and attach them to campaigns so Contact and Lead are measured.',
      },
      {
        title: 'TikTok campaigns',
        desc: 'Create, edit, pause, and review campaigns without opening TikTok Ads Manager.',
      },
      {
        title: 'Ad account top-up',
        desc: 'Add balance from $10 on USD accounts or 13,000 IQD on dinar accounts.',
      },
      {
        title: 'Works on mobile',
        desc: 'Open the site on your phone and run campaigns without logging into TikTok ads.',
      },
      {
        title: 'TikTok only',
        desc: 'Ads are created on TikTok alone. The extra locked platforms do not appear.',
      },
    ],
  },
  tiktok: {
    eyebrow: 'TikTok only',
    title: 'Those extra platforms no longer appear',
    subtitle:
      'Inside TikTok Ads Manager, other networks show up next to TikTok and cannot be turned off. ChatLoora creates the ad on TikTok only, so those placements are not part of the campaign.',
    steps: [
      { title: 'Link WhatsApp', desc: 'Connect the number that receives the ad chats.' },
      { title: 'Create a pixel', desc: 'Measure Contact and Lead from the campaign.' },
      { title: 'Publish on TikTok', desc: 'The ad is created for TikTok and nothing else.' },
      { title: 'Top up the account', desc: 'Add balance, then manage the campaign from your phone.' },
    ],
    bullets: [
      'No extra platforms locked beside TikTok',
      'Create and pause campaigns from ChatLoora',
      'Top up USD accounts from $10 and IQD accounts from 13,000',
      'Use the full site on a phone without opening TikTok Ads',
    ],
    cta: 'Start on TikTok only',
    shotAlt: 'TikTok Ads Manager with other platforms locked beside TikTok',
    shotCaption: 'The red box marks the platforms that stay locked beside TikTok.',
    shotProblemTitle: 'A normal TikTok ad',
    shotProblem:
      'The red box is the placement row inside TikTok Ads Manager. Other networks sit beside TikTok and cannot be removed, so you cannot choose TikTok only.',
    shotSolutionTitle: 'A ChatLoora ad',
    shotSolution:
      'The campaign is created inside ChatLoora and published on TikTok alone. Those extra platforms are not added, so the views stay on TikTok.',
  },
  meta: {
    eyebrow: 'Meta',
    title: 'Facebook, Instagram & Messenger — connected',
    subtitle:
      'Bring Meta conversations into the same inbox your team already uses for WhatsApp and Telegram.',
    items: ['Facebook Pages', 'Instagram DMs', 'Messenger threads', 'Unified team replies'],
  },
  clinics: {
    eyebrow: 'AI for clinics',
    title: 'A smart receptionist for your clinic — working 24 hours',
    subtitle:
      'Your AI receptionist answers patients, books appointments, and protects your staff from repetitive questions.',
    capabilities: [
      'Answer patient questions instantly',
      'Book appointments automatically',
      'Reschedule and cancel bookings',
      'Share clinic location & working hours',
      'Remember patient information',
      'Transfer urgent cases to staff',
    ],
    calendarTitle: 'Google Calendar Integration',
    calendarDesc:
      'Check availability, book directly, prevent double bookings, send confirmations, and remind patients automatically.',
    previewLabel: 'Clinic dashboard preview',
  },
  sales: {
    eyebrow: 'AI for sales',
    title: 'An AI closer that never sleeps',
    subtitle: 'From first message to qualified lead — ChatLoora helps your sales engine run around the clock.',
    items: [
      { title: 'Prices & Products', desc: 'Accurate answers from your catalog and training.' },
      { title: 'Delivery & Availability', desc: 'Clear logistics answers that reduce drop-off.' },
      { title: 'Orders', desc: 'Collect details and confirm orders conversationally.' },
      { title: 'Upsell & Cross-sell', desc: 'Recommend the right next product naturally.' },
      { title: 'Lead Qualification', desc: 'Score intent and route hot leads to humans.' },
    ],
  },
  integrations: {
    eyebrow: 'Integrations',
    title: 'Your stack, connected',
    subtitle: 'ChatLoora sits at the center of messaging, ads, calendar, and AI.',
  },
  how: {
    eyebrow: 'How it works',
    title: 'From signup to a TikTok campaign',
    subtitle: 'Link a number, create a pixel, publish on TikTok only, and top up the ad account.',
    steps: [
      { title: 'Create your account', desc: 'Sign up and choose a plan.' },
      { title: 'Link WhatsApp', desc: 'Connect the number that receives ad chats.' },
      { title: 'Create a pixel', desc: 'Track Contact and Lead for the campaign.' },
      { title: 'Build the campaign', desc: 'Set budget, audience, and the TikTok video.' },
      { title: 'Publish on TikTok only', desc: 'The extra locked platforms are not included.' },
      { title: 'Top up the ad account', desc: 'From $10 or 13,000 IQD, based on the account currency.' },
      { title: 'Manage on your phone', desc: 'Pause, edit, and review without opening TikTok Ads.' },
    ],
  },
  video: {
    eyebrow: 'Product tour',
    title: 'See ChatLoora in Action',
    subtitle: 'WhatsApp, pixels, TikTok-only campaigns, and ad-account top-ups from one site — including on your phone.',
    placeholder: 'Video coming soon — start your trial to get a live walkthrough.',
  },
  testimonials: {
    eyebrow: 'Customers',
    title: 'Built for people who advertise on TikTok',
    subtitle: 'Create the campaign in ChatLoora, keep it on TikTok, and manage it from your phone.',
    items: [
      {
        quote:
          'I create the campaign in ChatLoora and it stays on TikTok. I no longer fight the extra platforms that Ads Manager will not let me remove.',
        name: 'Dr. Sara Al-Hassan',
        role: 'Clinic Director',
        company: 'Nour Medical Clinic',
        industry: 'Medical Clinic',
      },
      {
        quote:
          'I link the WhatsApp number, attach the pixel, and launch. The whole flow stays inside ChatLoora.',
        name: 'Omar Khalil',
        role: 'Founder',
        company: 'Urban Cart',
        industry: 'E-commerce',
      },
      {
        quote:
          'I top up the ad account from the site and check results on my phone without opening TikTok Ads.',
        name: 'Maya Farouk',
        role: 'Growth Lead',
        company: 'Pulse Agency',
        industry: 'Marketing Agency',
      },
      {
        quote:
          'Pausing a campaign or changing the budget takes a minute on the phone. I do not log into the ad account.',
        name: 'Hassan Rami',
        role: 'Operations Manager',
        company: 'Table & Thyme',
        industry: 'Restaurant',
      },
      {
        quote:
          'The pixel and the WhatsApp number are connected before the campaign goes live, so the readings belong to that ad.',
        name: 'Lina Qassem',
        role: 'Academic Coordinator',
        company: 'Bright Path Center',
        industry: 'Training Center',
      },
      {
        quote:
          'I manage more than one ad account from the same panel and top each one up in its own currency.',
        name: 'Nour Jabari',
        role: 'Owner',
        company: 'Glow Aesthetics',
        industry: 'Beauty Clinic',
      },
    ],
  },
  stats: {
    eyebrow: 'Results',
    title: 'Numbers that build trust',
    items: [
      { value: 100, suffix: '%', label: 'Ads created on TikTok only' },
      { value: 10, suffix: '$', label: 'Minimum USD top-up' },
      { value: 13000, suffix: '', label: 'Minimum IQD top-up' },
      { value: 24, suffix: '/7', label: 'Manage campaigns on mobile' },
    ],
  },
  trial: {
    eyebrow: 'Free trial',
    title: '3 days free. No credit card. No payment.',
    subtitle: 'Register, send your email, get activated, and receive tutorials — then launch with confidence.',
    steps: ['Register', 'Send Email', 'Trial Activated', 'Receive Tutorials'],
    cta: 'Start Free Trial Now',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Simple plans that scale with you',
    subtitle: 'WhatsApp numbers, pixels, TikTok campaigns, and support. Higher plans add AI campaign review.',
    monthly: 'Monthly',
    perMonth: '/month',
    popular: 'Most Popular',
    cta: 'Choose plan',
    plans: [
      {
        name: 'Basic',
        price: '$15',
        features: ['1 WhatsApp number', '3 tracking pixels', 'Professional TikTok campaigns', 'Support'],
      },
      {
        name: 'Professional',
        price: '$25',
        features: [
          '3 WhatsApp numbers',
          '15 tracking pixels',
          'TikTok campaign creation',
          'AI campaign review',
          'Ongoing support',
        ],
      },
      {
        name: 'Business',
        price: '$49',
        features: [
          '10 WhatsApp numbers',
          'Unlimited pixels',
          'TikTok campaign creation',
          'AI campaign review',
          'Priority support',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions teams ask before they start',
    subtitle: 'Clear answers so you can decide with confidence.',
    items: [
      {
        q: 'What is ChatLoora?',
        a: 'ChatLoora lets you link WhatsApp numbers, create pixels, publish TikTok-only campaigns, and top up ad accounts from the website — including on your phone.',
      },
      {
        q: 'Do I need a credit card for the free trial?',
        a: 'No. Your 3-day free trial requires no credit card and no payment upfront.',
      },
      {
        q: 'How do I activate the trial?',
        a: 'Create an account, send your registered email, and our team activates your workspace and sends training videos.',
      },
      {
        q: 'Can I use the site on my phone?',
        a: 'Yes. The panel is built for phones, so you can create and manage campaigns without opening your TikTok ad account.',
      },
      {
        q: 'Why do other platforms appear beside TikTok?',
        a: 'In TikTok Ads Manager those placements are locked and cannot be removed. ChatLoora creates the ad on TikTok only, so they are not part of the campaign.',
      },
      {
        q: 'Can I create TikTok campaigns here?',
        a: 'Yes. You link the ad account, create the campaign inside ChatLoora, and it is published on TikTok only.',
      },
      {
        q: 'What can I do in the panel?',
        a: 'Link WhatsApp numbers, create pixels, build TikTok campaigns, and top up ad accounts.',
      },
      {
        q: 'What is the minimum top-up?',
        a: '$10 for US dollar ad accounts and 13,000 IQD for Iraqi dinar accounts. The card payment is collected in IQD.',
      },
      {
        q: 'Is my data isolated from other companies?',
        a: 'Yes. ChatLoora is multi-tenant with workspace isolation, permissions, and secure access controls.',
      },
      {
        q: 'Can I manage multiple WhatsApp numbers?',
        a: 'Yes. Basic includes 1 number, Professional includes 3, and Business includes 10.',
      },
      {
        q: 'How many pixels can I create?',
        a: 'Basic includes 3, Professional includes 15, and Business has no pixel limit.',
      },
      {
        q: 'How fast can I launch?',
        a: 'After you link WhatsApp and a pixel, you can create the TikTok campaign and top up the ad account from the same panel.',
      },
      {
        q: 'Do I have to open TikTok Ads Manager?',
        a: 'No. You create, pause, and review campaigns from ChatLoora on desktop or on your phone.',
      },
      {
        q: 'What happens after the free trial?',
        a: 'Choose Basic, Professional, or Business and continue without losing your training or connections.',
      },
      {
        q: 'How do I get support?',
        a: 'Contact us on WhatsApp or email. Trial users also receive setup tutorials after activation.',
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Talk to us today',
    subtitle: 'Prefer a human conversation? Reach out and we’ll help you launch ChatLoora.',
    whatsapp: 'Chat on WhatsApp',
    email: 'Email support',
    social: 'Follow ChatLoora',
  },
  footer: {
    product: 'Product',
    company: 'Company',
    resources: 'Resources',
    legal: 'Legal',
    rights: 'All rights reserved.',
    tagline: 'TikTok campaigns, pixels, WhatsApp, and ad-account top-ups.',
    privacy: 'Privacy',
    terms: 'Terms',
    companyInfo: 'Company information',
    whatsappApi: 'WhatsApp Cloud API',
    windowsApp: 'Windows desktop app',
  },
  seo: {
    title: 'ChatLoora — TikTok ads from your phone',
    description:
      'Link WhatsApp, create pixels, publish campaigns on TikTok only, and top up ad accounts. The extra platforms locked beside TikTok in Ads Manager are not included.',
  },
};

export type LandingCopy = typeof landingEn;

const landingAr: LandingCopy = {
  nav: {
    home: 'الرئيسية',
    features: 'المميزات',
    solutions: 'تيك توك فقط',
    howItWorks: 'طريقة العمل',
    pricing: 'الأسعار',
    testimonials: 'آراء العملاء',
    faq: 'الأسئلة الشائعة',
    contact: 'تواصل معنا',
    login: 'تسجيل الدخول',
    startTrial: 'ابدأ التجربة المجانية',
    becomePartner: 'كن شريكاً',
    menu: 'القائمة',
  },
  hero: {
    badge: 'إعلانات تيك توك من جات لورا',
    titleLine1: 'أنشئ إعلانك على تيك توك فقط.',
    titleLine2: 'من جوالك، بدون مدير الإعلانات.',
    subtitle:
      'اربط رقم الواتساب والبكسل، أنشئ الحملة، وعبّئ رصيد الحساب الإعلاني من جات لورا. الإعلان ينزل على تيك توك وحدها، بدون المنصات المقفلة التي تظهر بجانب تيك توك داخل مدير الإعلانات ولا يمكن حذفها.',
    ctaPrimary: 'ابدأ التجربة المجانية',
    ctaSecondary: 'شاهد طريقة العمل',
    downloadWindows: 'تنزيل ChatLoora لـ Windows',
    downloadWindowsHint: 'ملف تثبيت Windows (.exe) — شغّله مباشرة للتثبيت',
    trusted: 'موثوق به من قبل الشركات',
    stars: 'تقييم 5.0 من فرق متنامية',
  },
  audience: {
    eyebrow: 'لمن صُممت',
    title: 'مصممة للفرق التي تعيش داخل محادثات العملاء',
    subtitle: 'من العيادات إلى المتاجر الإلكترونية — ChatLoora تتكيف مع طريقة بيعك ودعمك.',
    items: [
      { title: 'التجارة الإلكترونية', desc: 'أجب عن أسئلة المنتجات وأغلق الطلبات أسرع.' },
      { title: 'العيادات', desc: 'احجز، أعد الجدولة، ووجّه المرضى على مدار الساعة.' },
      { title: 'المراكز الطبية', desc: 'حوّل الحالات العاجلة وأدر المواعيد باحتراف.' },
      { title: 'المطاعم', desc: 'إدارة الحجوزات والقائمة ومحادثات التوصيل.' },
      { title: 'العقارات', desc: 'أهّل العملاء واحجز معاينات العقارات.' },
      { title: 'الوكالات', desc: 'شغّل واتساب وإعلانات العملاء من مكان واحد.' },
      { title: 'مراكز التعليم', desc: 'سجّل الطلاب وأجب عن أسئلة الدورات فوراً.' },
      { title: 'عيادات التجميل', desc: 'احجز الجلسات وتابع العملاء تلقائياً.' },
      { title: 'فرق الدعم', desc: 'وحّد القنوات وسلّم المحادثة مع السياق الكامل.' },
      { title: 'فرق المبيعات', desc: 'أهّل العملاء ولا تفوّت أي فرصة ساخنة.' },
    ],
  },
  problems: {
    eyebrow: 'المشكلة',
    title: 'مدير إعلانات تيك توك يثبت منصات أخرى بجانب تيك توك',
    subtitle: 'عند إنشاء إعلان اعتيادي تظهر أيقونات منصات أخرى بجانب تيك توك ولا يمكن إزالتها، فتُحتسب المشاهدات خارج تيك توك.',
    items: [
      'منصات مقفلة بجانب تيك توك',
      'لا يمكن حذفها من مدير الإعلانات',
      'المشاهدات تُحسب على تلك المنصات',
      'إدارة الحملة من داخل حساب تيك توك',
    ],
    solutionTitle: 'جات لورا تنشر على تيك توك فقط',
    solutionSubtitle: 'تنشئ الحملة من داخل المنصة فتُنشر على تيك توك وحدها. تربط الواتساب، تنشئ البكسل، تعبئ الرصيد، وتدير الحملة من جوالك دون فتح الحساب الإعلاني.',
  },
  features: {
    eyebrow: 'ما تحصل عليه',
    title: 'صلاحيات لوحة جات لورا',
    subtitle: 'ربط الواتساب، البكسلات، حملات تيك توك، وتعبئة الحسابات الإعلانية. تعمل من الجوال كما تعمل من الحاسوب.',
    items: [
      {
        title: 'ربط أرقام الواتساب',
        desc: 'اربط الرقم الذي يستقبل محادثات الإعلان حسب باقتك.',
      },
      {
        title: 'بكسلات التتبع',
        desc: 'أنشئ البكسل واربطه بالحملة لقياس Contact وLead.',
      },
      {
        title: 'حملات تيك توك',
        desc: 'أنشئ الحملة وعدّلها وشغّلها أو أوقفها من اللوحة دون فتح مدير إعلانات تيك توك.',
      },
      {
        title: 'تعبئة الحسابات',
        desc: 'الحد الأدنى 10$ لحسابات الدولار و13000 د.ع لحسابات الدينار.',
      },
      {
        title: 'تعمل على الجوال',
        desc: 'افتح الموقع من هاتفك وأدر الحملات بدون الدخول إلى حسابات تيك توك الإعلانية.',
      },
      {
        title: 'تيك توك فقط',
        desc: 'الإعلان يُنشأ على تيك توك وحدها. المنصات المقفلة التي تظهر في الصورة لا تُضاف.',
      },
    ],
  },
  tiktok: {
    eyebrow: 'تيك توك فقط',
    title: 'المنصات التي بجانب تيك توك لم تعد جزءاً من إعلانك',
    subtitle:
      'في مدير إعلانات تيك توك تظهر منصات أخرى بجانب تيك توك ولا يمكن إزالتها. جات لورا تحل ذلك: الحملة تُنشأ على تيك توك فقط من داخل المنصة.',
    steps: [
      { title: 'اربط الواتساب', desc: 'الرقم الذي يستقبل محادثات الإعلان.' },
      { title: 'أنشئ البكسل', desc: 'لقياس Contact وLead من الحملة.' },
      { title: 'انشر على تيك توك', desc: 'الإعلان يُنشأ لتيك توك وحدها.' },
      { title: 'عبّئ الرصيد', desc: 'ثم أدر الحملة من جوالك.' },
    ],
    bullets: [
      'لا منصات إضافية مقفلة بجانب تيك توك',
      'إنشاء الحملة وإيقافها من جات لورا',
      'تعبئة الدولار من 10$ والدينار من 13000 د.ع',
      'الموقع يعمل على الجوال بدون فتح حساب تيك توك',
    ],
    cta: 'ابدأ على تيك توك فقط',
    shotAlt: 'مدير إعلانات تيك توك والمنصات المقفلة بجانب تيك توك',
    shotCaption: 'الإطار الأحمر يحدد المنصات التي تبقى مقفلة بجانب تيك توك ولا يمكن حذفها.',
    shotProblemTitle: 'الإعلان التقليدي على تيك توك',
    shotProblem:
      'الإطار الأحمر هو صف المنصات داخل مدير إعلانات تيك توك. تظهر بجانب تيك توك ولا يمكن حذفها، لذلك لا تستطيع اختيار تيك توك فقط.',
    shotSolutionTitle: 'إعلان جات لورا',
    shotSolution:
      'الحملة تُنشأ من داخل جات لورا وتُنشر على تيك توك وحدها. هذه المنصات لا تُضاف، فتبقى المشاهدات على تيك توك.',
  },
  meta: {
    eyebrow: 'Meta',
    title: 'فيسبوك وإنستغرام وماسنجر — متصلون',
    subtitle: 'اجلب محادثات Meta إلى نفس الصندوق الذي يستخدمه فريقك لواتساب وتيليجرام.',
    items: ['صفحات فيسبوك', 'رسائل إنستغرام', 'محادثات ماسنجر', 'ردود فريق موحّدة'],
  },
  clinics: {
    eyebrow: 'ذكاء اصطناعي للعيادات',
    title: 'موظف استقبال ذكي لعيادتك يعمل 24 ساعة',
    subtitle: 'يجيب المرضى، يحجز المواعيد، ويحمي فريقك من الأسئلة المتكررة.',
    capabilities: [
      'الرد على أسئلة المرضى فوراً',
      'حجز المواعيد تلقائياً',
      'إعادة الجدولة والإلغاء',
      'إرسال موقع العيادة وساعات العمل',
      'تذكر معلومات المريض',
      'تحويل الحالات العاجلة للموظفين',
    ],
    calendarTitle: 'تكامل Google Calendar',
    calendarDesc:
      'تحقق من الأوقات المتاحة، احجز مباشرة، امنع الحجز المزدوج، أرسل التأكيدات والتذكيرات تلقائياً.',
    previewLabel: 'معاينة لوحة العيادة',
  },
  sales: {
    eyebrow: 'ذكاء اصطناعي للمبيعات',
    title: 'مندوب مبيعات ذكي لا ينام',
    subtitle: 'من أول رسالة إلى عميل مؤهل — ChatLoora تشغّل محرك مبيعاتك على مدار الساعة.',
    items: [
      { title: 'الأسعار والمنتجات', desc: 'إجابات دقيقة من كتالوجك وتدريبك.' },
      { title: 'التوصيل والتوفر', desc: 'إجابات لوجستية واضحة تقلل الانسحاب.' },
      { title: 'الطلبات', desc: 'جمع التفاصيل وتأكيد الطلب محادثةً.' },
      { title: 'البيع الإضافي والمتقاطع', desc: 'اقتراح المنتج المناسب بشكل طبيعي.' },
      { title: 'تأهيل العملاء', desc: 'تقييم النية وتحويل الفرص الساخنة للبشر.' },
    ],
  },
  integrations: {
    eyebrow: 'التكاملات',
    title: 'أدواتك... متصلة',
    subtitle: 'ChatLoora في مركز الرسائل والإعلانات والتقويم والذكاء الاصطناعي.',
  },
  how: {
    eyebrow: 'طريقة العمل',
    title: 'من التسجيل إلى حملة على تيك توك',
    subtitle: 'اربط الرقم، أنشئ البكسل، انشر على تيك توك فقط، ثم عبّئ الحساب الإعلاني.',
    steps: [
      { title: 'أنشئ حسابك', desc: 'سجّل واختر الباقة.' },
      { title: 'اربط الواتساب', desc: 'الرقم الذي يستقبل محادثات الإعلان.' },
      { title: 'أنشئ البكسل', desc: 'لقياس Contact وLead.' },
      { title: 'ابنِ الحملة', desc: 'الميزانية والجمهور وفيديو تيك توك.' },
      { title: 'انشر على تيك توك فقط', desc: 'المنصات المقفلة لا تُضاف.' },
      { title: 'عبّئ الحساب', desc: 'من 10$ أو 13000 د.ع حسب عملة الحساب.' },
      { title: 'أدرها من الجوال', desc: 'إيقاف وتعديل ومراجعة دون فتح حساب تيك توك.' },
    ],
  },
  video: {
    eyebrow: 'جولة المنتج',
    title: 'شاهد ChatLoora أثناء العمل',
    subtitle: 'واتساب، بكسلات، حملات على تيك توك فقط، وتعبئة الحسابات من موقع واحد يعمل على الجوال.',
    placeholder: 'الفيديو قريباً — ابدأ تجربتك لتحصل على شرح مباشر.',
  },
  testimonials: {
    eyebrow: 'العملاء',
    title: 'لمن يعلن على تيك توك',
    subtitle: 'أنشئ الحملة في جات لورا، أبقها على تيك توك، وأدرها من جوالك.',
    items: [
      {
        quote:
          'أنشئ الحملة من جات لورا فتبقى على تيك توك. ما عاد أواجه المنصات التي لا يمكن حذفها من مدير الإعلانات.',
        name: 'د. سارة الحسن',
        role: 'مديرة العيادة',
        company: 'عيادة نور الطبية',
        industry: 'عيادة طبية',
      },
      {
        quote: 'أربط رقم الواتساب والبكسل ثم أطلق الحملة. كل الخطوات داخل جات لورا.',
        name: 'عمر خليل',
        role: 'مؤسس',
        company: 'Urban Cart',
        industry: 'تجارة إلكترونية',
      },
      {
        quote: 'أعبّئ الحساب الإعلاني من الموقع وأتابع النتائج من الجوال بدون فتح حساب تيك توك.',
        name: 'مايا فاروق',
        role: 'مسؤولة النمو',
        company: 'Pulse Agency',
        industry: 'وكالة تسويق',
      },
      {
        quote: 'إيقاف الحملة أو تغيير الميزانية يتم من الجوال خلال دقيقة.',
        name: 'حسن رامي',
        role: 'مدير العمليات',
        company: 'Table & Thyme',
        industry: 'مطعم',
      },
      {
        quote: 'البكسل ورقم الواتساب يُربطان قبل نشر الحملة حتى تكون القراءة للحملة نفسها.',
        name: 'لينا قاسم',
        role: 'منسقة أكاديمية',
        company: 'Bright Path Center',
        industry: 'مركز تدريب',
      },
      {
        quote: 'أدير أكثر من حساب إعلاني من اللوحة نفسها وأعبّئ كل حساب بعملته.',
        name: 'نور جباري',
        role: 'مالكة',
        company: 'Glow Aesthetics',
        industry: 'عيادة تجميل',
      },
    ],
  },
  stats: {
    eyebrow: 'النتائج',
    title: 'أرقام تبني الثقة',
    items: [
      { value: 100, suffix: '%', label: 'إعلانات تُنشأ على تيك توك فقط' },
      { value: 10, suffix: '$', label: 'أدنى تعبئة بالدولار' },
      { value: 13000, suffix: '', label: 'أدنى تعبئة بالدينار' },
      { value: 24, suffix: '/7', label: 'إدارة الحملات من الجوال' },
    ],
  },
  trial: {
    eyebrow: 'تجربة مجانية',
    title: '3 أيام مجاناً. بدون بطاقة. بدون دفع.',
    subtitle: 'سجّل، أرسل بريدك، فعّل التجربة، واستلم الشروحات — ثم انطلق بثقة.',
    steps: ['التسجيل', 'إرسال البريد', 'تفعيل التجربة', 'استلام الشروحات'],
    cta: 'ابدأ التجربة المجانية الآن',
  },
  pricing: {
    eyebrow: 'الأسعار',
    title: 'باقات بسيطة تنمو معك',
    subtitle: 'أرقام واتساب وبكسلات وحملات تيك توك ودعم فني. الباقات الأعلى تضيف تقييم الحملات بالذكاء الاصطناعي.',
    monthly: 'شهري',
    perMonth: '/شهر',
    popular: 'الأكثر طلباً',
    cta: 'اختر الباقة',
    plans: [
      {
        name: 'Basic',
        price: '$15',
        features: ['رقم واتساب واحد', '3 بكسلات تتبع', 'حملات احترافية على تيك توك', 'دعم فني'],
      },
      {
        name: 'Professional',
        price: '$25',
        features: ['3 أرقام واتساب', '15 بكسل', 'إنشاء حملات تيك توك', 'تقييم بالذكاء الاصطناعي', 'دعم فني متواصل'],
      },
      {
        name: 'Business',
        price: '$49',
        features: [
          '10 أرقام واتساب',
          'بكسلات بلا حد',
          'إنشاء حملات تيك توك',
          'تقييم بالذكاء الاصطناعي',
          'دعم فني ذو أولوية',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    title: 'أسئلة يسألها الفريق قبل البدء',
    subtitle: 'إجابات واضحة لتقرر بثقة.',
    items: [
      {
        q: 'ما هي ChatLoora؟',
        a: 'جات لورا تربط أرقام الواتساب، وتنشئ البكسلات، وتنشر الحملات على تيك توك فقط، وتعبّئ الحسابات الإعلانية من الموقع، بما في ذلك من الجوال.',
      },
      {
        q: 'هل أحتاج بطاقة للتجربة المجانية؟',
        a: 'لا. تجربة 3 أيام بدون بطاقة وبدون دفع مقدماً.',
      },
      {
        q: 'كيف أفعّل التجربة؟',
        a: 'أنشئ حساباً، أرسل بريدك المسجّل، ونفعّل مساحة عملك ونرسل فيديوهات التدريب.',
      },
      {
        q: 'هل يعمل الموقع على الجوال؟',
        a: 'نعم. اللوحة مناسبة للهاتف، فتنشئ الحملات وتديرها دون الدخول إلى حساب تيك توك الإعلاني.',
      },
      {
        q: 'لماذا تظهر منصات أخرى بجانب تيك توك؟',
        a: 'داخل مدير إعلانات تيك توك هذه المنصات مقفلة ولا يمكن حذفها. جات لورا تنشئ الإعلان على تيك توك فقط فلا تكون جزءاً من الحملة.',
      },
      {
        q: 'هل أنشئ حملة تيك توك من هنا؟',
        a: 'نعم. تربط الحساب الإعلاني وتنشئ الحملة داخل جات لورا فتُنشر على تيك توك فقط.',
      },
      {
        q: 'ماذا أفعل من اللوحة؟',
        a: 'ربط أرقام الواتساب، إنشاء البكسلات، بناء حملات تيك توك، وتعبئة الحسابات الإعلانية.',
      },
      {
        q: 'ما الحد الأدنى للتعبئة؟',
        a: '10 دولارات لحسابات الدولار و13000 دينار عراقي لحسابات الدينار. الدفع بالبطاقة يتم بالدينار.',
      },
      {
        q: 'هل بياناتي معزولة عن الشركات الأخرى؟',
        a: 'نعم. المنصة متعددة المستأجرين مع عزل لكل مساحة عمل وصلاحيات آمنة.',
      },
      {
        q: 'هل أدير أكثر من رقم واتساب؟',
        a: 'نعم. الأساسية رقم واحد، والاحترافية 3 أرقام، والأعمال 10 أرقام.',
      },
      {
        q: 'كم بكسل أستطيع إنشاءه؟',
        a: 'الأساسية 3 بكسلات، والاحترافية 15، والأعمال بلا حد.',
      },
      {
        q: 'كم يستغرق الإطلاق؟',
        a: 'بعد ربط الواتساب والبكسل تنشئ حملة تيك توك وتعبئ الحساب من اللوحة نفسها.',
      },
      {
        q: 'هل أفتح مدير إعلانات تيك توك؟',
        a: 'لا. تنشئ الحملة وتوقفها وتراجعها من جات لورا على الحاسوب أو الجوال.',
      },
      {
        q: 'ماذا بعد انتهاء التجربة؟',
        a: 'اختر Basic أو Professional أو Business وتابع دون فقدان التدريب أو الربط.',
      },
      {
        q: 'كيف أحصل على الدعم؟',
        a: 'تواصل عبر واتساب أو البريد. مستخدمو التجربة يستلمون شروحات بعد التفعيل.',
      },
    ],
  },
  contact: {
    eyebrow: 'تواصل معنا',
    title: 'تحدث معنا اليوم',
    subtitle: 'تفضل محادثة بشرية؟ تواصل وسنساعدك على إطلاق ChatLoora.',
    whatsapp: 'محادثة واتساب',
    email: 'البريد الإلكتروني',
    social: 'تابع ChatLoora',
  },
  footer: {
    product: 'المنتج',
    company: 'الشركة',
    resources: 'الموارد',
    legal: 'قانوني',
    rights: 'جميع الحقوق محفوظة.',
    tagline: 'حملات تيك توك، بكسلات، واتساب، وتعبئة الحسابات الإعلانية.',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    companyInfo: 'معلومات الشركة',
    whatsappApi: 'واتساب Cloud API',
    windowsApp: 'تطبيق Windows',
  },
  seo: {
    title: 'جات لورا — إعلانات تيك توك من جوالك',
    description:
      'اربط الواتساب، أنشئ البكسل، انشر الحملة على تيك توك فقط، وعبّئ الحساب الإعلاني. المنصات المقفلة بجانب تيك توك في مدير الإعلانات لا تُضاف.',
  },
};

export const landingCopy: Record<Locale, LandingCopy> = {
  en: landingEn,
  ar: landingAr,
};

export function getLandingCopy(locale: Locale): LandingCopy {
  return landingCopy[locale] ?? landingEn;
}
