export type FlashCourse = {
  n: string;
  title: string;
  blurb: string;
  detail: string;
  learn: string[];
  image: string;
  brands: string[];
};

export const FLASH_COURSES: FlashCourse[] = [
  {
    n: '01',
    title: 'إعلانات فيسبوك وإنستغرام',
    blurb: 'شلون تطلق حملة وتوصل للزبون بدون ما تضيع فلوسك على تجارب عشوائية.',
    detail:
      'هذي الدورة تعلّمك الأساس العملي: شون تسوي إعلان، منو تستهدف، وشلون تقرا النتيجة. مو حفظ نظري، تطلع فاهم شلون تشتغل على المنصة.',
    learn: ['فتح الحساب الإعلاني وفهم اللوحة', 'اختيار الجمهور والميزانية بهدوء', 'كتابة إعلان وربطه بصفحة الطلب', 'قرائة النتائج وتحسين الحملة'],
    image: '/store/flash-12-courses/courses/01.jpg',
    brands: ['facebook', 'instagram'],
  },
  {
    n: '02',
    title: 'ماستر كلاس Canva',
    blurb: 'تصمم منشورات وإعلانات بسرعة حتى لو ما عندك خبرة تصميم.',
    detail:
      'Canva يريّحك من المصمم لكل صورة. تتعلم القوالب والمقاسات حتى محتواك يطلع مرتب وجاهز للنشر أو للبيع.',
    learn: ['قوالب جاهزة للمنشورات والإعلانات', 'مقاسات فيسبوك وإنستغرام والريلز', 'ألوان وخطوط بسيطة لهوية واضحة', 'تصدير الملفات بجودة مناسبة'],
    image: '/store/flash-12-courses/courses/02.jpg',
    brands: ['canva'],
  },
  {
    n: '03',
    title: 'بيع المنتجات الرقمية',
    blurb: 'تحوّل ملف أو مهارة إلى منتج ينطلب من الموبايل.',
    detail:
      'المنتج الرقمي ما يحتاج مخزن بالبيت. تتعلم فكرة المنتج، شلون تعرضه، وشلون الزبون يطلبه بوضوح.',
    learn: ['اختيار فكرة منتج تنباع', 'كتابة عرض بيع بسيط ومقنع', 'ترتيب الملفات والتسليم', 'أخطاء تمنع الزبون يكمّل الطلب'],
    image: '/store/flash-12-courses/courses/03.jpg',
    brands: ['shop'],
  },
  {
    n: '04',
    title: 'التسويق الرقمي الاحترافي',
    blurb: 'خريطة واضحة: من الانتباه إلى الطلب، بدون تشتيت.',
    detail:
      'تجمع لك التسويق بمسار واحد: شلون يجيك الزبون، ليش يثق، وشلون يحوّل لطلب. مناسبة للي يبي يبدأ وما يعرف منين يمسك الطرف.',
    learn: ['الفرق بين المحتوى والإعلان', 'رسالة عرض يفهمها الزبون', 'قنوات مجانية ومدفوعة', 'ترتيب الأولويات بدل تجربة كلشي'],
    image: '/store/flash-12-courses/courses/04.jpg',
    brands: ['ads', 'facebook'],
  },
  {
    n: '05',
    title: 'الطباعة عند الطلب بالذكاء الاصطناعي',
    blurb: 'تصاميم تتحول لتيشيرت ومنتجات بدون ما تخزّن كميات.',
    detail:
      'مدخل عملي للطباعة عند الطلب: تصميم، رفع المنتج، وفهم الطلب بعد البيع. الذكاء الاصطناعي يسرّع الأفكار، مو يشتغل عنك كلشي.',
    learn: ['فكرة متجر بدون مخزون تقليدي', 'تصميم منتج بسيط ينطبع', 'أدوات مساعدة للتصاميم', 'تنظيم الطلبات ويا الزبون'],
    image: '/store/flash-12-courses/courses/05.jpg',
    brands: ['print', 'chatgpt'],
  },
  {
    n: '06',
    title: 'الربح من بيع الكتب الإلكترونية',
    blurb: 'من الفكرة لملف جاهز ينباع، بخطوات عملية.',
    detail:
      'الكتاب الإلكتروني منتج واضح. تختار موضوع مطلوب، ترتب الفصول، وتنسّق الملف وتعرضه بطريقة يفهمها الزبون العراقي.',
    learn: ['اختيار موضوع الكتاب', 'ترتيب الفصول والعناوين', 'تنسيق ملف سهل القراءة', 'عرض الكتاب كمنتج مو كمنشور مجاني'],
    image: '/store/flash-12-courses/courses/06.jpg',
    brands: ['ebook'],
  },
  {
    n: '07',
    title: 'التسويق بالعمولة',
    blurb: 'تروّج منتجات غيرك وتاخذ عمولة لما يصير بيع.',
    detail:
      'إذا ما عندك منتجك هسه، العمولة طريق تبدأ فيه. تختار عرض مناسب، تشرحّه بصدق، وتربطه بطريقة يقدر المتابع يطلب منها.',
    learn: ['اختيار عروض تناسب الناس اللي تتابعك', 'الترويج بوضوح بدون مبالغة', 'روابط وتتبع بسيط', 'استمرار بمحتوى ثابت مو منشور واحد'],
    image: '/store/flash-12-courses/courses/07.jpg',
    brands: ['affiliate'],
  },
  {
    n: '08',
    title: 'صناعة الفيديوهات بالذكاء الاصطناعي',
    blurb: 'تسرّع السكربت والمشاهد والمونتاج بمساعدة الأدوات.',
    detail:
      'الذكاء الاصطناعي ما يلغي شغلك، بس يختصر الوقت. تتعلم شلون تجيب أفكار ومشاهد أسرع وتكمّل المونتاج بنفسك.',
    learn: ['تخطيط فيديو قصير قبل التصوير', 'أدوات للنص والمشاهد', 'تجميع اللقطات بترتيب', 'تصدير بجودة تناسب المنصات'],
    image: '/store/flash-12-courses/courses/08.jpg',
    brands: ['chatgpt', 'youtube'],
  },
  {
    n: '09',
    title: 'احتراف اليوتيوب وتحقيق الأرباح',
    blurb: 'أساس القناة: الفكرة، الحلقة، والثبات، وبعدين مسارات الربح.',
    detail:
      'يوتيوب يحتاج وضوح أكثر من الحماس. تتعلم قناة مفهومة، عناوين وصور مصغّرة، وجدول نشر واقعي. الربح يجي بعد ما تبني مشاهدة، وما نعدك برقم معيّن.',
    learn: ['اختيار فكرة قناة واضحة', 'هيكل الحلقة والمقدمة', 'الصورة المصغّرة والعنوان', 'مسارات الربح بعد بناء المشاهدة'],
    image: '/store/flash-12-courses/courses/09.jpg',
    brands: ['youtube'],
  },
  {
    n: '10',
    title: 'بناء بزنس بالذكاء الاصطناعي والأتمتة',
    blurb: 'تنظّم شغلك اليومي وتختصر المهام المتكررة.',
    detail:
      'هواي شغل رقمي يضيع بالتكرار. تتعلم ترتب المهام، تستخدم أدوات للمحتوى والمتابعة، وتبني روتين تقدر تستمر عليه.',
    learn: ['ترتيب مهام المشروع بقائمة واحدة', 'أتمتة المهام المتكررة', 'استخدام الذكاء الاصطناعي كمساعد', 'روتين أسبوعي ينمشي'],
    image: '/store/flash-12-courses/courses/10.jpg',
    brands: ['chatgpt'],
  },
  {
    n: '11',
    title: 'احتراف Adobe Premiere لصناعة الفيديو',
    blurb: 'مونتاج عملي للمبتدئ: قص، ترتيب، صوت، وتصدير.',
    detail:
      'Premiere مهارة مطلوبة بالفريلانس والمحتوى. الدورة على الشغل العملي: استيراد، قص، كتابة على الشاشة، وتصدير فيديو جاهز.',
    learn: ['واجهة البرنامج وأول مشروع', 'قص المشاهد وترتيبها', 'الصوت والموسيقى بحجم مناسب', 'تصدير للمنصات'],
    image: '/store/flash-12-courses/courses/11.jpg',
    brands: ['premiere'],
  },
  {
    n: '12',
    title: 'صناعة فيديوهات Reels',
    blurb: 'مقاطع قصيرة تمسك الانتباه من أول ثواني.',
    detail:
      'الريلز أسرع طريق للوصول هسه. تتعلم الفكرة، التصوير بالموبايل، القص السريع، والنص على الشاشة حتى المقطع يوصل الفكرة ويحث على الطلب.',
    learn: ['أفكار ريلز تقدر تنفذها اليوم', 'تصوير بالموبايل بإضاءة بسيطة', 'مونتاج سريع ونص ظاهر', 'ربط المقطع بطلب أو عرض'],
    image: '/store/flash-12-courses/courses/12.jpg',
    brands: ['instagram', 'tiktok'],
  },
];

export const FLASH_AUDIENCES = [
  { title: 'تبدأ من الصفر', text: 'مسار واحد مرتب بدل الضياع بين فيديوهات يوتيوب.' },
  { title: 'عندك مشروع صغير', text: 'إعلان وتصميم ومحتوى بدون ما تعيّن فريق من أول يوم.' },
  { title: 'عندك متجر', text: 'مهارات تساعدك تعرض بضاعتك وتجيب طلب أوضح.' },
  { title: 'تصنع محتوى', text: 'Canva والريلز وPremiere والذكاء الاصطناعي بحزمة وحدة.' },
  { title: 'فريلانسر أو مسوّق', text: 'مهارات السوق تطلبها: إعلان، فيديو، وبيع رقمي.' },
  { title: 'تحب الذكاء الاصطناعي', text: 'تطبيق عملي على المحتوى والفيديو، مو كلام فاضي.' },
  { title: 'طالب أو خريج', text: 'مهارات تبني عليها خدمة أو مشروع صغير.' },
  { title: 'جرّبت ووقفت', text: 'ترجعك لنقطة بداية واضحة بدل كل مرة تبدأ من الصفر.' },
];

export const FLASH_FAQS = [
  { q: 'شنو يوصلني بالضبط؟', a: 'فلاشة USB 32 GB محمّل عليها 12 دورة مثل ما موجودة بالصفحة، والتوصيل مجاني ويا هالعرض.' },
  { q: 'أحتاج إنترنت بعد ما توصل؟', a: 'الملفات على الفلاشة. توصلها لجهازك وتشوفها. بعض الأدوات بالدورات ممكن تحتاج إنترنت وقت التطبيق.' },
  { q: 'هذي للمبتدئ لو لا؟', a: 'إي، مرتبة للي يبي يبدأ، وفيها تفاصيل كافية للي يريد يتوسع بعدين.' },
  { q: 'تضمنولي دخل شهري؟', a: 'لا. هذي مهارات عملية. الربح يعتمد عليك وعلى وقتك والسوق. ما نعد بأرقام.' },
  { q: 'شلون أطلب؟', a: 'اكتب رقمك وعنوانك واضغط تأكيد الطلب. نتصل عليك ونأكد التوصيل. ما تحتاج تسوي حساب.' },
  { q: 'متى توصلني؟', a: 'بعد ما نأكد الطلب بالهاتف نرتب التوصيل حسب منطقتك، ونخبرك بالتفاصيل.' },
  { q: 'التوصيل مجاني؟', a: 'إي، مجاني ويا هالعرض لكل العراق.' },
  { q: 'السعر لكل الدورات لو لدورة وحدة؟', a: 'للحزمة كاملة: 12 دورة على فلاشة واحدة.' },
  { q: 'أكدر ألغي قبل التوصيل؟', a: 'تكدر توضّح أي شي ويا المندوب لما يتصل عليك قبل الاستلام.' },
];

export const FLASH_BENEFITS = [
  { title: 'إعلان يفهمه الزبون', text: 'تعرف شلون توصل لجمهورك بدل ما تحرق ميزانية تجريب.' },
  { title: 'محتوى شكله مرتب', text: 'تصمم بـ Canva بدون ما تستنى مصمم لكل صورة.' },
  { title: 'فيديو جاهز يننشر', text: 'ريلز وPremiere وذكاء اصطناعي حتى تسرّع الإنتاج.' },
  { title: 'بيع رقمي وعمولة', text: 'مسارات ما تعتمد بس على بضاعة مخزونة بالبيت.' },
  { title: 'شغلك يترتب', text: 'أتمتة بسيطة وروتين حتى مشروعك ما يوقف بعد أسبوع.' },
  { title: 'كلشي بمكان واحد', text: '12 مهارة على فلاشة وحدة بدل دورات متفرقة تضيع ملفاتها.' },
];

export const FLASH_GAINS = [
  'مسار تعلم واضح من الإعلان للفيديو والبيع',
  'الملفات وياك على فلاشة، ما تضيع بين روابط',
  'توفّر مقارنة لو تشتري كل دورة لحاله',
  'مهارات تستخدمها بمشروعك أو كخدمة للناس',
  'توصيل مجاني وطلب بدقيقة بدون حساب',
];

export const FLASH_LOSSES = [
  'تضيّع أسابيع بفيديوهات متفرقة بلا خطة',
  'تدفع بعدين لكل دورة سعر أعلى من هالحزمة',
  'تبقى تقول «بعدين أبدأ» والسنة تمشي',
  'مشروعك يبقى بدون إعلان وفيديو',
  'تخسر سعر العرض إذا خلص العدّاد',
];

export const FLASH_STEPS = [
  { n: '1', title: 'اطلب بدقيقة', text: 'رقم هاتف وعنوان. لا حساب ولا تحويل هسه.' },
  { n: '2', title: 'نأكد وياك', text: 'نتصل على رقمك ونأكد الطلب والعنوان.' },
  { n: '3', title: 'الفلاشة توصلك', text: 'توصلها للجهاز وتبدأ أول دورة بنفس اليوم.' },
];

export const FLASH_DEFAULT_TESTIMONIALS = [
  { name: 'أحمد من بغداد', text: 'كنت ضايع بين دورات مجانية. الفلاشة رتبتلي الموضوع: إعلان وتصميم وفيديو بمكان واحد.', stars: 5 },
  { name: 'سارة من البصرة', text: 'طلبت بدون لف ودوران والتوصيل وصل. Canva والريلز فادوني من أول أسبوع.', stars: 5 },
  { name: 'حسين من أربيل', text: 'السعر مناسب مقابل اللي كنت ناوي أدفعه لدورات منفصلة. Premiere يحتاج وقت بس البداية صارت أوضح.', stars: 5 },
  { name: 'نور من النجف', text: 'المحتوى عملي مو كلام. طلبت لأخوي هم بعد ما شفت الملفات.', stars: 5 },
  { name: 'علي من الموصل', text: 'أنا مبتدئ تمام. دورة الإعلانات والبيع الرقمي فهمتني منين أبدأ.', stars: 5 },
  { name: 'زينب من كربلاء', text: 'سهلة على اللابتوب. حبيت كل الدورات مجتمعة وما أحتاج روابط هواي.', stars: 5 },
];

export type LandingCopyInput = Record<string, unknown> | null | undefined;

type Pair = { title: string; text: string };
type Faq = { q: string; a: string };

export type FlashLandingCopy = {
  topBar: string;
  navBrand: string;
  navCourses: string;
  navValue: string;
  navReviews: string;
  navCta: string;
  heroBadge: string;
  heroTitle: string;
  heroLead: string;
  heroBullets: string[];
  heroCta: string;
  heroCoursesLink: string;
  countdownLabel: string;
  stepsTitle: string;
  steps: Array<{ n: string; title: string; text: string }>;
  coursesTitle: string;
  coursesSubtitle: string;
  courseLearnLabel: string;
  courseCta: string;
  coursesCta: string;
  courses: FlashCourse[];
  valueTitle: string;
  valueSubtitle: string;
  benefits: Pair[];
  gainsTitle: string;
  gains: string[];
  lossesTitle: string;
  losses: string[];
  delayCta: string;
  audiencesTitle: string;
  audiences: Pair[];
  offerTitle: string;
  offerSubtitle: string;
  offerCta: string;
  reviewsTitle: string;
  reviewsSubtitle: string;
  faqTitle: string;
  faqs: Faq[];
  trustDelivery: string;
  trustCourses: string;
  trustPhone: string;
  trustAccount: string;
  orderTitle: string;
  orderHint: string;
  orderName: string;
  orderNameOptional: string;
  orderPhone: string;
  orderAddress: string;
  orderAddressPlaceholder: string;
  orderSubmit: string;
  orderSubmitting: string;
  orderFreeDelivery: string;
  orderTotal: string;
  footerCta: string;
  footerNote: string;
  footerTimer: string;
  videosTitle: string;
  videosSubtitle: string;
  videoOneTitle: string;
  videoTwoTitle: string;
  stickyCta: string;
  unavailable: string;
};

export const FLASH_DEFAULT_COPY: FlashLandingCopy = {
  topBar: 'عرض محدّد · {compareBar}هسه {price} · توصيل مجاني · 12 دورة على فلاشة وحدة',
  navBrand: 'فلاشة 12 دورة',
  navCourses: 'الدورات',
  navValue: 'شتستفيد',
  navReviews: 'التجارب',
  navCta: 'اطلب هسه',
  heroBadge: '32 GB · 12 دورة · توصيل مجاني لكل العراق',
  heroTitle: 'فلاشة ذهبية فيها كلشي تحتاجه حتى تبدأ من الإنترنت… بدل ما تشتري 12 دورة لحاله',
  heroLead:
    'إعلانات، تصميم، فيديو، ذكاء اصطناعي، وبيع رقمي — على فلاشة وحدة توصلك لباب البيت. السعر اليوم {price}{compare}. لا تفوّت العرض.',
  heroBullets: ['تبدأ أول دورة يوم توصلك الفلاشة', 'ما تحتاج تسوي حساب حتى تطلب', 'السعر للحزمة كاملة مو لدورة وحدة'],
  heroCta: 'اطلب الفلاشة هسه — التوصيل مجاني',
  heroCoursesLink: 'شوف الدورات الـ 12',
  countdownLabel: 'الوقت الباقي لهالسعر',
  stepsTitle: 'شلون توصلك الفلاشة؟',
  steps: FLASH_STEPS,
  coursesTitle: 'محتويات الدورات الـ 12 بالتفصيل',
  coursesSubtitle: 'اضغط على الدورة حتى تقرا شراح تتعلم. الشعارات تبين المنصة، والمحتوى كامل على الفلاشة.',
  courseLearnLabel: 'شنو راح تتعلم؟',
  courseCta: 'أريد هالدورات على فلاشتي',
  coursesCta: 'أريد الـ 12 دورة هسه',
  courses: FLASH_COURSES,
  valueTitle: 'شنو تستفيد من الفلاشة؟',
  valueSubtitle: 'مهارات عملية تبني عليها. ما نعدك بدخل مضمون.',
  benefits: FLASH_BENEFITS,
  gainsTitle: 'إذا طلبت اليوم',
  gains: FLASH_GAINS,
  lossesTitle: 'إذا أجّلت وقلت بعدين',
  losses: FLASH_LOSSES,
  delayCta: 'لا تؤجّل — اطلب هسه',
  audiencesTitle: 'هذي الفلاشة لمن؟',
  audiences: FLASH_AUDIENCES,
  offerTitle: 'حزمة كاملة بسعر دورة وحدة تقريباً',
  offerSubtitle: '12 دورة + فلاشة 32 GB + توصيل مجاني. السعر ثابت من النظام.',
  offerCta: 'ابدأ هسه بـ {price}',
  reviewsTitle: 'تجارب ناس طلبوا الحزمة',
  reviewsSubtitle: 'آراء عن وضوح المحتوى وسهولة الطلب. النتيجة تعتمد على تطبيقك.',
  faqTitle: 'أسئلة قبل ما تطلب',
  faqs: FLASH_FAQS,
  trustDelivery: 'توصيل مجاني',
  trustCourses: '12 دورة كاملة',
  trustPhone: 'تأكيد عبر الهاتف',
  trustAccount: 'طلب بدون حساب',
  orderTitle: 'اطلب فلاشتك هسه',
  orderHint: 'اكتب رقمك وعنوانك. الحزمة: 12 دورة + فلاشة 32 GB + توصيل مجاني.',
  orderName: 'الاسم الكامل',
  orderNameOptional: '(اختياري)',
  orderPhone: 'رقم الهاتف',
  orderAddress: 'العنوان',
  orderAddressPlaceholder: 'المحافظة، المنطقة، أقرب نقطة دالة',
  orderSubmit: 'أكّد الطلب — {price}',
  orderSubmitting: 'جاي نثبت الطلب...',
  orderFreeDelivery: 'التوصيل مجاني',
  orderTotal: 'المجموع',
  footerCta: 'اطلب فلاشتك هسه — التوصيل مجاني',
  footerNote: 'طلب بدون حساب · ما نعد بأرباح مضمونة · النتيجة على تطبيقك',
  footerTimer: 'العرض الحالي يظهر عدّاداً محدداً على الصفحة',
  videosTitle: 'محتويات الفلاش وفيديو تجريبي من داخل أحد الدورات',
  videosSubtitle: 'الفيديوان يشتغلون على الصفحة مباشرة لما توصل لهالقسم.',
  videoOneTitle: 'محتويات الفلاش',
  videoTwoTitle: 'فيديو تجريبي من داخل أحد الدورات',
  stickyCta: 'اطلب هسه — {price}',
  unavailable: 'المنتج غير متاح للطلب حالياً. يرجى المحاولة لاحقاً.',
};

function asText(raw: unknown, fallback: string) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || fallback;
}

function asLines(raw: unknown, fallback: string[]) {
  if (!Array.isArray(raw)) return fallback;
  const lines = raw.map((item) => String(item || '').trim()).filter(Boolean);
  return lines.length ? lines : fallback;
}

function asPairs(raw: unknown, fallback: Pair[]): Pair[] {
  if (!Array.isArray(raw)) return fallback;
  const rows = raw
    .map((item, i) => {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        title: asText(rec.title, fallback[i]?.title || ''),
        text: asText(rec.text, fallback[i]?.text || ''),
      };
    })
    .filter((row) => row.title || row.text);
  return rows.length ? rows : fallback;
}

function asFaqs(raw: unknown, fallback: Faq[]): Faq[] {
  if (!Array.isArray(raw)) return fallback;
  const rows = raw
    .map((item, i) => {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        q: asText(rec.q, fallback[i]?.q || ''),
        a: asText(rec.a, fallback[i]?.a || ''),
      };
    })
    .filter((row) => row.q || row.a);
  return rows.length ? rows : fallback;
}

export function mergeLandingCopy(partial?: LandingCopyInput): FlashLandingCopy {
  const rec = partial && typeof partial === 'object' && !Array.isArray(partial) ? (partial as Record<string, unknown>) : {};
  const coursesRaw = Array.isArray(rec.courses) ? rec.courses : [];
  const courses = FLASH_COURSES.map((course, i) => {
    const extra = coursesRaw[i] && typeof coursesRaw[i] === 'object' ? (coursesRaw[i] as Record<string, unknown>) : {};
    return {
      ...course,
      title: asText(extra.title, course.title),
      blurb: asText(extra.blurb, course.blurb),
      detail: asText(extra.detail, course.detail),
      learn: asLines(extra.learn, course.learn),
    };
  });
  const stepsRaw = Array.isArray(rec.steps) ? rec.steps : [];
  const steps = FLASH_STEPS.map((step, i) => {
    const extra = stepsRaw[i] && typeof stepsRaw[i] === 'object' ? (stepsRaw[i] as Record<string, unknown>) : {};
    return {
      ...step,
      title: asText(extra.title, step.title),
      text: asText(extra.text, step.text),
    };
  });
  return {
    ...FLASH_DEFAULT_COPY,
    topBar: asText(rec.topBar, FLASH_DEFAULT_COPY.topBar),
    navBrand: asText(rec.navBrand, FLASH_DEFAULT_COPY.navBrand),
    navCourses: asText(rec.navCourses, FLASH_DEFAULT_COPY.navCourses),
    navValue: asText(rec.navValue, FLASH_DEFAULT_COPY.navValue),
    navReviews: asText(rec.navReviews, FLASH_DEFAULT_COPY.navReviews),
    navCta: asText(rec.navCta, FLASH_DEFAULT_COPY.navCta),
    heroBadge: asText(rec.heroBadge, FLASH_DEFAULT_COPY.heroBadge),
    heroTitle: asText(rec.heroTitle, FLASH_DEFAULT_COPY.heroTitle),
    heroLead: asText(rec.heroLead, FLASH_DEFAULT_COPY.heroLead),
    heroBullets: asLines(rec.heroBullets, FLASH_DEFAULT_COPY.heroBullets),
    heroCta: asText(rec.heroCta, FLASH_DEFAULT_COPY.heroCta),
    heroCoursesLink: asText(rec.heroCoursesLink, FLASH_DEFAULT_COPY.heroCoursesLink),
    countdownLabel: asText(rec.countdownLabel, FLASH_DEFAULT_COPY.countdownLabel),
    stepsTitle: asText(rec.stepsTitle, FLASH_DEFAULT_COPY.stepsTitle),
    steps,
    coursesTitle: asText(rec.coursesTitle, FLASH_DEFAULT_COPY.coursesTitle),
    coursesSubtitle: asText(rec.coursesSubtitle, FLASH_DEFAULT_COPY.coursesSubtitle),
    courseLearnLabel: asText(rec.courseLearnLabel, FLASH_DEFAULT_COPY.courseLearnLabel),
    courseCta: asText(rec.courseCta, FLASH_DEFAULT_COPY.courseCta),
    coursesCta: asText(rec.coursesCta, FLASH_DEFAULT_COPY.coursesCta),
    courses,
    valueTitle: asText(rec.valueTitle, FLASH_DEFAULT_COPY.valueTitle),
    valueSubtitle: asText(rec.valueSubtitle, FLASH_DEFAULT_COPY.valueSubtitle),
    benefits: asPairs(rec.benefits, FLASH_DEFAULT_COPY.benefits),
    gainsTitle: asText(rec.gainsTitle, FLASH_DEFAULT_COPY.gainsTitle),
    gains: asLines(rec.gains, FLASH_DEFAULT_COPY.gains),
    lossesTitle: asText(rec.lossesTitle, FLASH_DEFAULT_COPY.lossesTitle),
    losses: asLines(rec.losses, FLASH_DEFAULT_COPY.losses),
    delayCta: asText(rec.delayCta, FLASH_DEFAULT_COPY.delayCta),
    audiencesTitle: asText(rec.audiencesTitle, FLASH_DEFAULT_COPY.audiencesTitle),
    audiences: asPairs(rec.audiences, FLASH_DEFAULT_COPY.audiences),
    offerTitle: asText(rec.offerTitle, FLASH_DEFAULT_COPY.offerTitle),
    offerSubtitle: asText(rec.offerSubtitle, FLASH_DEFAULT_COPY.offerSubtitle),
    offerCta: asText(rec.offerCta, FLASH_DEFAULT_COPY.offerCta),
    reviewsTitle: asText(rec.reviewsTitle, FLASH_DEFAULT_COPY.reviewsTitle),
    reviewsSubtitle: asText(rec.reviewsSubtitle, FLASH_DEFAULT_COPY.reviewsSubtitle),
    faqTitle: asText(rec.faqTitle, FLASH_DEFAULT_COPY.faqTitle),
    faqs: asFaqs(rec.faqs, FLASH_DEFAULT_COPY.faqs),
    trustDelivery: asText(rec.trustDelivery, FLASH_DEFAULT_COPY.trustDelivery),
    trustCourses: asText(rec.trustCourses, FLASH_DEFAULT_COPY.trustCourses),
    trustPhone: asText(rec.trustPhone, FLASH_DEFAULT_COPY.trustPhone),
    trustAccount: asText(rec.trustAccount, FLASH_DEFAULT_COPY.trustAccount),
    orderTitle: asText(rec.orderTitle, FLASH_DEFAULT_COPY.orderTitle),
    orderHint: asText(rec.orderHint, FLASH_DEFAULT_COPY.orderHint),
    orderName: asText(rec.orderName, FLASH_DEFAULT_COPY.orderName),
    orderNameOptional: asText(rec.orderNameOptional, FLASH_DEFAULT_COPY.orderNameOptional),
    orderPhone: asText(rec.orderPhone, FLASH_DEFAULT_COPY.orderPhone),
    orderAddress: asText(rec.orderAddress, FLASH_DEFAULT_COPY.orderAddress),
    orderAddressPlaceholder: asText(rec.orderAddressPlaceholder, FLASH_DEFAULT_COPY.orderAddressPlaceholder),
    orderSubmit: asText(rec.orderSubmit, FLASH_DEFAULT_COPY.orderSubmit),
    orderSubmitting: asText(rec.orderSubmitting, FLASH_DEFAULT_COPY.orderSubmitting),
    orderFreeDelivery: asText(rec.orderFreeDelivery, FLASH_DEFAULT_COPY.orderFreeDelivery),
    orderTotal: asText(rec.orderTotal, FLASH_DEFAULT_COPY.orderTotal),
    footerCta: asText(rec.footerCta, FLASH_DEFAULT_COPY.footerCta),
    footerNote: asText(rec.footerNote, FLASH_DEFAULT_COPY.footerNote),
    footerTimer: asText(rec.footerTimer, FLASH_DEFAULT_COPY.footerTimer),
    videosTitle: asText(rec.videosTitle, FLASH_DEFAULT_COPY.videosTitle),
    videosSubtitle: asText(rec.videosSubtitle, FLASH_DEFAULT_COPY.videosSubtitle),
    videoOneTitle: asText(rec.videoOneTitle, FLASH_DEFAULT_COPY.videoOneTitle),
    videoTwoTitle: asText(rec.videoTwoTitle, FLASH_DEFAULT_COPY.videoTwoTitle),
    stickyCta: asText(rec.stickyCta, FLASH_DEFAULT_COPY.stickyCta),
    unavailable: asText(rec.unavailable, FLASH_DEFAULT_COPY.unavailable),
  };
}

export function fillLandingVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{(price|original|compare|compareBar|save|pct)\}/g, (_, key: string) => vars[key] ?? '');
}

