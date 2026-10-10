function clip(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

function clipList(raw: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.map((item) => clip(item, maxLen)).filter((item): item is string => Boolean(item));
  if (!items.length) return undefined;
  return items.slice(0, maxItems);
}

function clipPairs(
  raw: unknown,
  maxItems: number,
  left: string,
  right: string,
  leftMax: number,
  rightMax: number,
): Array<Record<string, string>> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: Array<Record<string, string>> = [];
  for (const entry of raw.slice(0, maxItems)) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const a = clip(rec[left], leftMax);
    const b = clip(rec[right], rightMax);
    if (!a && !b) continue;
    const row: Record<string, string> = {};
    if (a) row[left] = a;
    if (b) row[right] = b;
    items.push(row);
  }
  return items.length ? items : undefined;
}

const STRING_FIELDS: Array<[string, number]> = [
  ['topBar', 240],
  ['navBrand', 80],
  ['navCourses', 40],
  ['navValue', 40],
  ['navReviews', 40],
  ['navCta', 40],
  ['heroBadge', 120],
  ['heroTitle', 280],
  ['heroLead', 800],
  ['heroCta', 120],
  ['heroCoursesLink', 80],
  ['countdownLabel', 80],
  ['stepsTitle', 120],
  ['coursesTitle', 160],
  ['coursesSubtitle', 400],
  ['courseLearnLabel', 80],
  ['courseCta', 80],
  ['coursesCta', 80],
  ['valueTitle', 160],
  ['valueSubtitle', 400],
  ['gainsTitle', 80],
  ['lossesTitle', 80],
  ['delayCta', 80],
  ['audiencesTitle', 120],
  ['offerTitle', 160],
  ['offerSubtitle', 400],
  ['offerCta', 80],
  ['reviewsTitle', 160],
  ['reviewsSubtitle', 400],
  ['faqTitle', 120],
  ['trustDelivery', 40],
  ['trustCourses', 40],
  ['trustPhone', 40],
  ['trustAccount', 40],
  ['orderTitle', 80],
  ['orderHint', 240],
  ['orderName', 40],
  ['orderNameOptional', 40],
  ['orderPhone', 40],
  ['orderAddress', 40],
  ['orderAddressPlaceholder', 80],
  ['orderSubmit', 80],
  ['orderSubmitting', 80],
  ['orderFreeDelivery', 40],
  ['orderTotal', 40],
  ['footerCta', 120],
  ['footerNote', 200],
  ['footerTimer', 160],
  ['videosTitle', 200],
  ['videosSubtitle', 240],
  ['videoOneTitle', 120],
  ['videoTwoTitle', 120],
  ['stickyCta', 80],
  ['unavailable', 200],
];

export function sanitizeLandingCopy(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, max] of STRING_FIELDS) {
    const value = clip(rec[key], max);
    if (value) out[key] = value;
  }
  const heroBullets = clipList(rec.heroBullets, 8, 160);
  if (heroBullets) out.heroBullets = heroBullets;
  const gains = clipList(rec.gains, 8, 200);
  if (gains) out.gains = gains;
  const losses = clipList(rec.losses, 8, 200);
  if (losses) out.losses = losses;
  const steps = clipPairs(rec.steps, 5, 'title', 'text', 80, 200);
  if (steps) out.steps = steps;
  const benefits = clipPairs(rec.benefits, 8, 'title', 'text', 80, 240);
  if (benefits) out.benefits = benefits;
  const audiences = clipPairs(rec.audiences, 8, 'title', 'text', 80, 200);
  if (audiences) out.audiences = audiences;
  const faqs = clipPairs(rec.faqs, 12, 'q', 'a', 160, 600);
  if (faqs) out.faqs = faqs;
  if (Array.isArray(rec.courses)) {
    const courses = rec.courses.slice(0, 12).map((item) => {
      if (!item || typeof item !== 'object') return {};
      const course = item as Record<string, unknown>;
      const row: Record<string, unknown> = {};
      const title = clip(course.title, 120);
      const blurb = clip(course.blurb, 240);
      const detail = clip(course.detail, 1200);
      const learn = clipList(course.learn, 8, 160);
      if (title) row.title = title;
      if (blurb) row.blurb = blurb;
      if (detail) row.detail = detail;
      if (learn) row.learn = learn;
      return row;
    });
    if (courses.some((row) => Object.keys(row).length)) out.courses = courses;
  }
  return Object.keys(out).length ? out : undefined;
}
