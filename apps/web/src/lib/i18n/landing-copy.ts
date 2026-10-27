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
    signInWeb: 'Sign in on the web',
    trusted: 'Trusted by Businesses',
    stars: 'Rated 5.0 by growing teams',
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
        name: 'Sara Al-Hassan',
        role: 'Marketing Manager',
        company: 'Nour Store',
        industry: 'Online store',
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
    subtitle: 'WhatsApp numbers, tracking pixels, TikTok campaigns, instant forms, and an online store on the top plan.',
    monthly: 'Monthly',
    perMonth: '/month',
    popular: 'Most Popular',
    cta: 'Choose plan',
    plans: [
      {
        name: 'Basic',
        price: '$15',
        features: [
          '1 connected WhatsApp number',
          '3 tracking pixels',
          'Link ad account to the platform',
          'Create TikTok campaigns',
        ],
      },
      {
        name: 'Professional',
        price: '$25',
        features: [
          '3 WhatsApp Business numbers',
          '10 tracking pixels',
          'Link account and create ads',
          'Instant form pages for products',
        ],
      },
      {
        name: 'Business',
        price: '$35',
        features: [
          '5 WhatsApp numbers',
          '20 tracking pixels',
          'Link account and create campaigns',
          'Instant forms and online store',
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
        a: 'Create an account, send your registered email, and our team activates your workspace and sends setup tutorials.',
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
        a: 'Link WhatsApp numbers, reply from the WhatsApp inbox, create pixels, build TikTok campaigns, publish instant forms, and top up ad accounts.',
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
        a: 'Yes. Basic includes 1 connected number, Professional includes 3, and Business includes 5. Only connected numbers count toward your limit.',
      },
      {
        q: 'How many pixels can I create?',
        a: 'Basic includes 3, Professional includes 10, and Business includes 20.',
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
        a: 'Choose Basic, Professional, or Business and continue without losing your data or connections.',
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
    whatsappNumber: '9647864314333',
    supportEmail: 'noreply@chatloora.com',
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
    signInWeb: 'Sign in on the web',
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
    signInWeb: 'تسجيل الدخول من الويب',
    trusted: 'موثوق به من قبل الشركات',
    stars: 'تقييم 5.0 من فرق متنامية',
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
        name: 'سارة الحسن',
        role: 'مديرة التسويق',
        company: 'متجر نور',
        industry: 'متجر إلكتروني',
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
    subtitle: 'أرقام واتساب وبكسلات تتبع وحملات تيك توك واستمارات فورية، مع المتجر الإلكتروني في باقة الأعمال.',
    monthly: 'شهري',
    perMonth: '/شهر',
    popular: 'الأكثر طلباً',
    cta: 'اختر الباقة',
    plans: [
      {
        name: 'Basic',
        price: '$15',
        features: [
          'رقم واتساب واحد متصل',
          '3 بكسلات تتبع',
          'ربط الحساب الإعلاني بالمنصة',
          'إنشاء حملات تيك توك',
        ],
      },
      {
        name: 'Professional',
        price: '$25',
        features: [
          '3 أرقام واتساب أعمال',
          '10 بكسلات تتبع',
          'ربط الحساب وإنشاء الإعلانات',
          'صفحات استمارة فورية للمنتجات',
        ],
      },
      {
        name: 'Business',
        price: '$35',
        features: [
          '5 أرقام واتساب',
          '20 بكسل تتبع',
          'ربط الحساب وإنشاء الحملات',
          'الاستمارات الفورية والمتجر الإلكتروني',
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
        a: 'أنشئ حساباً وأرسل بريدك المسجّل، فنفعّل مساحة عملك ونرسل لك شروحات الإعداد.',
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
        a: 'ربط أرقام الواتساب، الرد من صندوق واتساب، إنشاء البكسلات، بناء حملات تيك توك، نشر الاستمارات الفورية، وتعبئة الحسابات الإعلانية.',
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
        a: 'نعم. الأساسية رقم متصل واحد، والاحترافية 3 أرقام، والأعمال 5 أرقام. تُحسب فقط الأرقام المتصلة فعلياً بالمنصة.',
      },
      {
        q: 'كم بكسل أستطيع إنشاءه؟',
        a: 'الأساسية 3 بكسلات، والاحترافية 10، والأعمال 20.',
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
        a: 'اختر Basic أو Professional أو Business وتابع دون فقدان بياناتك أو الربط.',
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
    whatsappNumber: '9647864314333',
    supportEmail: 'noreply@chatloora.com',
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
    signInWeb: 'تسجيل الدخول من الويب',
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
