export type AssistantAction = {
  type: 'navigate';
  path: string;
  labelAr: string;
  labelEn: string;
};

type RouteDef = {
  path: string;
  labelAr: string;
  labelEn: string;
  keywords: string[];
};

export const ASSISTANT_ROUTES: RouteDef[] = [
  { path: '/connect', labelAr: 'ربط مواقع التواصل', labelEn: 'Connect social accounts', keywords: ['ربط', 'حسابات', 'connect social'] },
  { path: '/plans', labelAr: 'الباقات', labelEn: 'Plans', keywords: ['باقة', 'الباقات', 'اشتراك', 'ترقية', 'pricing', 'plans', 'upgrade'] },
  { path: '/account', labelAr: 'الحساب', labelEn: 'Account', keywords: ['حسابي', 'الحساب', 'account', 'فاتورة'] },
  { path: '/whatsapp', labelAr: 'واتساب', labelEn: 'WhatsApp', keywords: ['واتساب', 'whatsapp', 'qr', 'رقم واتساب', 'ربط واتساب'] },
  { path: '/inbox/whatsapp', labelAr: 'صندوق واتساب', labelEn: 'WhatsApp inbox', keywords: ['صندوق واتساب', 'رسائل واتساب', 'inbox whatsapp'] },
  { path: '/instagram', labelAr: 'إنستغرام', labelEn: 'Instagram', keywords: ['انستا', 'إنستغرام', 'instagram'] },
  { path: '/inbox/instagram', labelAr: 'صندوق إنستغرام', labelEn: 'Instagram inbox', keywords: ['رسائل انستا', 'صندوق انستا'] },
  { path: '/messenger', labelAr: 'ماسنجر', labelEn: 'Messenger', keywords: ['ماسنجر', 'فيسبوك', 'messenger', 'facebook'] },
  { path: '/inbox/messenger', labelAr: 'صندوق ماسنجر', labelEn: 'Messenger inbox', keywords: ['رسائل فيسبوك', 'صندوق ماسنجر'] },
  { path: '/telegram', labelAr: 'تيليغرام', labelEn: 'Telegram', keywords: ['تيليغرام', 'تليغرام', 'telegram'] },
  { path: '/inbox/telegram', labelAr: 'صندوق تيليغرام', labelEn: 'Telegram inbox', keywords: ['رسائل تليغرام'] },
  { path: '/inbox/social', labelAr: 'صندوق التواصل', labelEn: 'Social inbox', keywords: ['صندوق التواصل', 'social inbox'] },
  { path: '/tiktok/integration', labelAr: 'تكامل TikTok', labelEn: 'TikTok integration', keywords: ['تيك توك', 'tiktok', 'بكسل', 'pixel', 'بيكسل'] },
  { path: '/tiktok/integration/phones', labelAr: 'أرقام تتبع TikTok', labelEn: 'TikTok tracking phones', keywords: ['رقم تتبع', 'tracking phone', 'أرقام التتبع'] },
  { path: '/tiktok/integration/wizard', labelAr: 'معالج البكسل', labelEn: 'Pixel wizard', keywords: ['معالج', 'wizard'] },
  { path: '/tiktok/business', labelAr: 'إعلانات TikTok', labelEn: 'TikTok ads', keywords: ['إعلانات تيك', 'tiktok ads', 'حملة'] },
  { path: '/ai', labelAr: 'الذكاء الاصطناعي', labelEn: 'AI studio', keywords: ['ذكاء', 'رد تلقائي', 'ai studio', 'منتجات الذكاء'] },
  { path: '/ai/store', labelAr: 'متجري', labelEn: 'My Store', keywords: ['متجر', 'منتجات', 'store', 'كتالوج', 'مخزون'] },
  { path: '/ai-providers', labelAr: 'مزودو الذكاء', labelEn: 'AI providers', keywords: ['مفتاح الذكاء', 'openrouter', 'ai provider'] },
  { path: '/appointments', labelAr: 'المواعيد', labelEn: 'Appointments', keywords: ['موعد', 'مواعيد', 'عيادة', 'appointment'] },
  { path: '/bookings', labelAr: 'الطلبيات', labelEn: 'Orders', keywords: ['طلبيات', 'طلبات', 'booking', 'order'] },
  { path: '/customers', labelAr: 'العملاء', labelEn: 'Customers', keywords: ['عملاء', 'customers'] },
  { path: '/agents', labelAr: 'الوكلاء', labelEn: 'Agents', keywords: ['وكلاء', 'موظفين', 'agents'] },
  { path: '/analytics', labelAr: 'التحليلات', labelEn: 'Analytics', keywords: ['تحليلات', 'analytics'] },
  { path: '/settings/integrations', labelAr: 'التكاملات', labelEn: 'Integrations', keywords: ['تكامل', 'integrations'] },
  { path: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', keywords: ['إعدادات', 'settings'] },
  { path: '/platform', labelAr: 'المنصة', labelEn: 'Platform', keywords: ['منصة واتساب السحابي', 'cloud api', 'waba'] },
];

const ALLOWED = new Set(ASSISTANT_ROUTES.map((row) => row.path));

export function sanitizeAssistantPath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const path = raw.trim().split('?')[0].split('#')[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('..')) return null;
  if (!/^\/[a-z0-9\-/]*$/i.test(path)) return null;
  if (path.startsWith('/admin')) return null;
  if (ALLOWED.has(path)) return path;
  const prefix = ASSISTANT_ROUTES.find((row) => path === row.path || path.startsWith(`${row.path}/`));
  return prefix && ALLOWED.has(prefix.path) ? prefix.path : null;
}

export function routeByPath(path: string): AssistantAction | null {
  const safe = sanitizeAssistantPath(path);
  if (!safe) return null;
  const def = ASSISTANT_ROUTES.find((row) => row.path === safe);
  if (!def) return null;
  return { type: 'navigate', path: def.path, labelAr: def.labelAr, labelEn: def.labelEn };
}

export function wantsInAppNavigation(text: string) {
  return /رابط|افتح|فتح|وديني|روح|اعرض|ورّيني|وريني|طلع لي|خذني|open|link|take me|go to|show me|navigate/i.test(
    text,
  );
}

export function inferNavigateAction(text: string): AssistantAction | null {
  const q = text.toLowerCase();
  let best: { score: number; route: RouteDef } | null = null;
  let second = 0;
  for (const route of ASSISTANT_ROUTES) {
    let score = 0;
    for (const keyword of route.keywords) {
      if (q.includes(keyword.toLowerCase())) score += keyword.length > 4 ? 3 : 2;
    }
    if (score > (best?.score ?? 0)) {
      second = best?.score ?? 0;
      best = { score, route };
    } else if (score > second) {
      second = score;
    }
  }
  if (!best || best.score < 2) return null;
  if (second >= best.score) return null;
  return {
    type: 'navigate',
    path: best.route.path,
    labelAr: best.route.labelAr,
    labelEn: best.route.labelEn,
  };
}

export function parseAssistantActions(reply: string): { text: string; actions: AssistantAction[] } {
  const match = reply.match(/<<<ACTIONS\s*([\s\S]*?)\s*ACTIONS>>>/i);
  let text = reply;
  const actions: AssistantAction[] = [];
  if (match) {
    text = reply.replace(match[0], '').trim();
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        const path = typeof row === 'object' && row && 'path' in row ? String((row as { path: string }).path) : '';
        const action = routeByPath(path);
        if (action) actions.push(action);
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  return { text, actions: dedupeActions(actions) };
}

export function mergeActions(primary: AssistantAction[], extra: AssistantAction | null) {
  return dedupeActions(extra ? [...primary, extra] : primary);
}

export function navigationCatalogForPrompt() {
  return ASSISTANT_ROUTES.map((row) => `${row.path} — ${row.labelAr} / ${row.labelEn}`).join('\n');
}

function dedupeActions(actions: AssistantAction[]) {
  const seen = new Set<string>();
  return actions.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}
