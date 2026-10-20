export type KnowledgeArticleSeed = {
  slug: string;
  category: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  keywords: string[];
  sortOrder: number;
};

export const ASSISTANT_KNOWLEDGE_SEED: KnowledgeArticleSeed[] = [
  {
    slug: 'whatsapp-inbox',
    category: 'whatsapp',
    titleAr: 'ربط واتساب لصندوق الوارد',
    titleEn: 'Connect WhatsApp inbox',
    keywords: ['whatsapp', 'واتساب', 'qr', 'inbox', 'صندوق', 'ربط رقم'],
    sortOrder: 10,
    bodyAr:
      'من القائمة افتح واتساب. اضغط اتصال وامسح رمز QR من تطبيق واتساب على الهاتف (الأجهزة المرتبطة). انتظر حتى تصبح الحالة متصلة. عدد الأرقام المسموح يعتمد على باقتك. أرقام التتبع لـ TikTok تُربط من صفحة تكامل TikTok وليس من هذه الصفحة.',
    bodyEn:
      'Open WhatsApp in the sidebar. Tap Connect and scan the QR code from WhatsApp on your phone (Linked devices). Wait until status is Connected. How many numbers you can add depends on your plan. TikTok tracking numbers are connected from TikTok Integration, not this page.',
  },
  {
    slug: 'whatsapp-api',
    category: 'whatsapp_api',
    titleAr: 'ربط WhatsApp Cloud API',
    titleEn: 'Connect WhatsApp Cloud API',
    keywords: ['api', 'cloud', 'واتساب api', 'waba', 'embedded'],
    sortOrder: 20,
    bodyAr:
      'افتح واتساب أو منصة واتساب السحابي. استخدم التسجيل المضمّن من ميتا أو أدخل بيانات Cloud API يدوياً (phone number id و WABA). هذه الميزة تحتاج باقة تفعّل WhatsApp API. إذا كانت معطّلة في باقتك ستظهر رسالة ترقية.',
    bodyEn:
      'Open WhatsApp or the cloud WhatsApp page. Use Meta Embedded Signup or enter Cloud API credentials (phone number id and WABA). This requires a plan with WhatsApp API enabled. If it is off on your plan you will see an upgrade prompt.',
  },
  {
    slug: 'instagram',
    category: 'instagram',
    titleAr: 'ربط إنستغرام واستقبال الرسائل',
    titleEn: 'Connect Instagram and receive messages',
    keywords: ['instagram', 'انستا', 'إنستغرام', 'رسائل', 'تعليقات'],
    sortOrder: 30,
    bodyAr:
      'من التكاملات أو صفحة إنستغرام اضغط ربط وسجّل دخول ميتا واختر الصفحة المرتبطة بحساب الأعمال. فعّل رسائل إنستغرام في إعدادات الصفحة. إذا ربطت الحساب ولا تصل الرسائل: تأكد أن الحالة متصلة، أن الحساب Business/Creator مربوط بصفحة، وأنك ترد من صندوق التواصل داخل Chatloora. التعليقات تحتاج صلاحيات ميتا المعتمدة.',
    bodyEn:
      'From Integrations or Instagram, tap Connect, log in with Meta, and pick the Page linked to the business account. Enable Instagram messages on the Page. If DMs do not arrive: confirm Connected status, Business/Creator linked to a Page, and reply from Chatloora social inbox. Comments need approved Meta scopes.',
  },
  {
    slug: 'facebook',
    category: 'facebook',
    titleAr: 'ربط فيسبوك وماسنجر',
    titleEn: 'Connect Facebook Messenger',
    keywords: ['facebook', 'messenger', 'فيسبوك', 'ماسنجر', 'صفحة'],
    sortOrder: 40,
    bodyAr:
      'من التكاملات أو ماسنجر اربط صفحة فيسبوك عبر ميتا. بعد الربط تظهر المحادثات في صندوق التواصل. تأكد أن الباقة تسمح بفيسبوك وأن الصفحة متصلة.',
    bodyEn:
      'From Integrations or Messenger, connect a Facebook Page via Meta. Conversations appear in the social inbox. Confirm your plan allows Facebook and the Page shows Connected.',
  },
  {
    slug: 'telegram',
    category: 'telegram',
    titleAr: 'ربط تيليغرام',
    titleEn: 'Connect Telegram',
    keywords: ['telegram', 'تيليغرام', 'تليغرام', 'بوت'],
    sortOrder: 50,
    bodyAr:
      'افتح تيليغرام من القائمة. يمكنك ربط حساب شخصي عبر رمز الدخول أو بوت عبر توكن بوت فادر. الميزة تحتاج باقة تسمح بتيليغرام. المحادثات تظهر في صندوق التواصل.',
    bodyEn:
      'Open Telegram in the sidebar. Connect a personal account with a login code or a bot with a BotFather token. Your plan must allow Telegram. Chats appear in the social inbox.',
  },
  {
    slug: 'tiktok-pixel',
    category: 'tiktok',
    titleAr: 'تكامل TikTok والبكسل',
    titleEn: 'TikTok integration and pixels',
    keywords: ['tiktok', 'pixel', 'بيكسل', 'بكسل', 'تتبع', 'إعلان'],
    sortOrder: 60,
    bodyAr:
      'من تكامل TikTok أنشئ إعداداً جديداً: اربط حساب الإعلانات، اختر المعلن، أنشئ البكسل، اربط رقم واتساب للتتبع (من صفحة أرقام التتبع وليس صندوق الوارد)، أكمل المعالج حتى يصبح الرابط /r/ جاهزاً. حد البكسلات والأرقام حسب الباقة. إذا فشل الإنشاء تحقق من توكن Events API وحالة البكسل.',
    bodyEn:
      'In TikTok Integration create a setup: connect ads, pick advertiser, create the pixel, connect a tracking WhatsApp number (tracking phones page, not inbox), finish the wizard so the /r/ link is ready. Pixel and number limits come from your plan. If creation fails, check Events API token and pixel status.',
  },
  {
    slug: 'ai-auto-reply',
    category: 'ai',
    titleAr: 'تفعيل الرد الذكي',
    titleEn: 'Enable AI auto reply',
    keywords: ['ai', 'ذكاء', 'رد تلقائي', 'auto reply', 'منتجات'],
    sortOrder: 70,
    bodyAr:
      'افتح استوديو الذكاء واختر المنصة. فعّل الذكاء والرد التلقائي. أضف معرفة: نصوص، أسئلة شائعة، ومنتجات من قسم المنتجات حتى يستطيع الرد على الأسعار. تأكد أن القناة متصلة وأن باقتك تسمح بالذكاء الاصطناعي. إذا لا يرد: تحقق من التفعيل، ساعات العمل، وحدود الباقة، وأن الويب هوك/الجلسة متصلة.',
    bodyEn:
      'Open AI Studio, pick the platform, enable AI and auto-reply. Add knowledge: text, FAQs, and products so it can answer prices. The channel must be connected and your plan must allow AI. If it does not reply: check the toggle, business hours, plan limits, and that the session/webhook is connected.',
  },
  {
    slug: 'products',
    category: 'ai',
    titleAr: 'إضافة المنتجات للذكاء الاصطناعي',
    titleEn: 'Add products for AI',
    keywords: ['منتج', 'منتجات', 'product', 'سعر'],
    sortOrder: 80,
    bodyAr:
      'افتح استوديو الذكاء ثم متجري. أضف المنتجات بالاسم والوصف والسعر والكمية والصور. الذكاء يقرأ المخزون ويرد على طلبات الزبائن ويثبّت الطلب في الطلبيات. شارك رابط المتجر العام من إعدادات المتجر.',
    bodyEn:
      'Open AI Studio → My Store. Add products with name, description, price, quantity, and media. The AI reads stock, answers customers, and pins orders under Orders. Share the public store URL from store settings.',
  },
  {
    slug: 'inbox-messages',
    category: 'inbox',
    titleAr: 'استقبال الرسائل',
    titleEn: 'Receive messages',
    keywords: ['رسائل', 'صندوق', 'inbox', 'محادثة'],
    sortOrder: 90,
    bodyAr:
      'صندوق الوارد يعرض واتساب. صندوق التواصل يعرض ماسنجر وإنستغرام وتيليغرام. اختر القناة المتصلة من القائمة. إذا لا تظهر رسائل جديدة تأكد أن الحساب متصل وأنك تنظر للقناة الصحيحة.',
    bodyEn:
      'Inbox shows WhatsApp. Social inbox shows Messenger, Instagram, and Telegram. Pick the connected channel. If new messages are missing, confirm the account is connected and you are on the right channel.',
  },
  {
    slug: 'comments',
    category: 'social',
    titleAr: 'التعامل مع التعليقات',
    titleEn: 'Handle comments',
    keywords: ['تعليقات', 'comments', 'فيسبوك', 'انستا'],
    sortOrder: 100,
    bodyAr:
      'تعليقات فيسبوك وإنستغرام تظهر بعد ربط الصفحة والموافقة على صلاحيات التعليقات. يمكن للذكاء الرد حسب الإعدادات. إذا لا تظهر تعليقات قد تكون الصلاحيات غير معتمدة بعد من ميتا.',
    bodyEn:
      'Facebook and Instagram comments appear after the Page is connected and comment scopes are approved. AI can reply when enabled. Missing comments often mean Meta scopes are not approved yet.',
  },
  {
    slug: 'appointments',
    category: 'appointments',
    titleAr: 'المواعيد وحجوزات الأطباء',
    titleEn: 'Appointments and clinic bookings',
    keywords: ['موعد', 'حجز', 'طبيب', 'عيادة', 'calendar', 'مواعيد'],
    sortOrder: 110,
    bodyAr:
      'افتح المواعيد لإعداد النشاط والموظفين والخدمات. اربط تقويم Google من الإعدادات إن رغبت. العملاء يحجزون عبر المحادثة عندما تكون الميزة مفعّلة في الباقة. الطلبيات المنفصلة في قسم الطلبيات.',
    bodyEn:
      'Open Appointments to set the business, staff, and services. Optionally connect Google Calendar in settings. Customers book in chat when your plan includes appointments. Separate product orders live under Bookings.',
  },
  {
    slug: 'bookings-orders',
    category: 'bookings',
    titleAr: 'الطلبات والطلبيات',
    titleEn: 'Orders and bookings',
    keywords: ['طلب', 'طلبات', 'طلبيات', 'order'],
    sortOrder: 120,
    bodyAr:
      'الطلبيات المحفوظة من الذكاء تظهر في قسم الطلبيات. راجع التفاصيل وحالة الطلب من هناك.',
    bodyEn:
      'Orders captured by AI appear under Bookings. Review details and status there.',
  },
  {
    slug: 'subscription',
    category: 'billing',
    titleAr: 'الاشتراك وترقية الباقة',
    titleEn: 'Subscription and upgrades',
    keywords: ['باقة', 'اشتراك', 'ترقية', 'pricing', 'انتهاء', 'حساب'],
    sortOrder: 130,
    bodyAr:
      'من الحساب أو صفحة الباقات ترى خطتك وتاريخ الانتهاء. للترقية افتح الباقات واختر شهري أو سنوي وادفع. الحدود (أرقام واتساب، بكسلات، تواصل اجتماعي، AI) تأتي من الباقة. إذا وصلت للحد رقِّ الباقة. لا يحذف النظام مواردك عند التخفيض لكنه يمنع إضافة المزيد حتى تعود ضمن الحد.',
    bodyEn:
      'Account or Pricing shows your plan and renewal date. To upgrade open Pricing, pick monthly or yearly, and pay. Limits (WhatsApp numbers, pixels, social, AI) come from the plan. If you hit a cap, upgrade. Downgrade does not delete resources but blocks new ones until you are within the limit.',
  },
  {
    slug: 'new-account',
    category: 'account',
    titleAr: 'إضافة حساب أو رقم جديد',
    titleEn: 'Add a new account or number',
    keywords: ['حساب جديد', 'رقم جديد', 'إضافة'],
    sortOrder: 140,
    bodyAr:
      'أضف أرقام واتساب من صفحة واتساب، وحسابات التواصل من التكاملات، وبكسلات TikTok من التكامل. إذا الزر مقفول فباقتك لا تتضمن الميزة أو وصلت للحد.',
    bodyEn:
      'Add WhatsApp numbers on the WhatsApp page, social accounts from Integrations, and TikTok pixels from TikTok Integration. A locked button means your plan excludes the feature or you hit the limit.',
  },
  {
    slug: 'assistant-media',
    category: 'support',
    titleAr: 'إرسال صورة أو بصمة للمساعد',
    titleEn: 'Send a screenshot or voice note to the assistant',
    keywords: ['صورة', 'سكرين', 'screenshot', 'بصمة', 'صوت', 'اتصال'],
    sortOrder: 145,
    bodyAr:
      'يمكنك إرسال لقطة شاشة للمشكلة من زر الصورة داخل المساعد ليحلّلها ويقترح الحل. يمكنك أيضاً تسجيل بصمة صوتية بالضغط على الميكروفون ثم إرسالها كرسالة في المحادثة. إذا طلبت فتح الباقات أو أي قسم معروف سيفتحه المساعد داخل المنصة. الاتصال الصوتي المباشر متوقف حالياً.',
    bodyEn:
      'Send a screenshot of the problem with the image button so the assistant can diagnose it. You can also hold the microphone to send a voice note in the chat. If you ask to open Plans or another known section, the assistant opens it inside the app. Live voice calling is currently disabled.',
  },
  {
    slug: 'voice-phone',
    category: 'support',
    titleAr: 'المحادثة مع المساعد',
    titleEn: 'Chat with the Chatloora assistant',
    keywords: ['اتصال', 'هاتف', 'voice', 'twilio', 'مكالمة', 'محادثة'],
    sortOrder: 146,
    bodyAr:
      'المساعد يعمل بالمحادثة داخل المنصة (نص أو بصمة صوتية). خدمة الاتصال الصوتي المباشر متوقفة. إذا احتجت موظفاً استخدم زر التحدث مع الدعم أو واتساب 07864314333.',
    bodyEn:
      'The assistant works by in-app chat (text or a voice note). Live voice calling is disabled. For a human agent use Talk to support or WhatsApp 07864314333.',
  },
  {
    slug: 'settings-support',
    category: 'support',
    titleAr: 'الإعدادات والدعم الفني',
    titleEn: 'Settings and support',
    keywords: ['إعدادات', 'دعم', 'موظف', 'whatsapp support'],
    sortOrder: 150,
    bodyAr:
      'الإعدادات للمفاتيح والويب هوك. إذا احتجت موظفاً بشرياً استخدم زر التحدث مع موظف الدعم داخل هذا المساعد لفتح واتساب.',
    bodyEn:
      'Settings holds keys and webhooks. For a human agent use Talk to support in this assistant to open WhatsApp.',
  },
];
