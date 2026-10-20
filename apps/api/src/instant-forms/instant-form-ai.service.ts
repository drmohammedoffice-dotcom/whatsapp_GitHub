import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai/ai-provider.service';
import {
  createBlockId,
  createDefaultBlock,
  createFieldId,
  defaultLeadFormFields,
  emptyDocument,
  InstantFormBlock,
  InstantFormBlockType,
  InstantFormDocument,
  InstantFormField,
  starterDocument,
} from './instant-form.document';

const ALLOWED_BLOCK_TYPES = new Set<InstantFormBlockType>([
  'hero',
  'heading',
  'subheading',
  'paragraph',
  'image',
  'gallery',
  'features',
  'product_card',
  'badge',
  'guarantee',
  'testimonials',
  'faq',
  'countdown',
  'offer_countdown',
  'order_counter',
  'form',
  'multi_choice',
  'button',
  'whatsapp_button',
  'divider',
  'spacer',
  'banner',
]);

export type GenerateInstantFormInput = {
  brief: string;
  productName?: string;
  productDescription?: string;
  price?: number;
  compareAtPrice?: number;
  currency?: string;
  features?: string[];
  images?: string[];
  platform?: string;
  offerBadge?: string;
  extraNotes?: string;
};

@Injectable()
export class InstantFormAiService {
  private readonly logger = new Logger(InstantFormAiService.name);

  constructor(private readonly provider: AiProviderService) {}

  async generate(teamId: string, input: GenerateInstantFormInput): Promise<InstantFormDocument> {
    const brief = input.brief?.trim();
    if (!brief || brief.length < 10) {
      throw new BadRequestException('أدخل وصفاً كافياً للاستمارة (على الأقل 10 أحرف)');
    }

    const fallbackName = input.productName?.trim() || 'عرض جديد';
    const images = this.cleanImages(input.images);
    const features = this.cleanFeatures(input.features);
    const description =
      input.productDescription?.trim()
      || brief;

    const system = `You are an expert Arabic landing-page / Instant Form designer for Iraqi e-commerce ads (TikTok / Meta / Snapchat).
Build a premium product landing-page Instant Form as STRICT JSON only (no markdown).

Schema:
{
  "product": {
    "name": string,
    "description": string,
    "price": number,
    "compareAtPrice": number|null,
    "discountLabel": string|null,
    "currency": "IQD"|"USD",
    "badge": string|null,
    "salesCount": number|null,
    "rating": number|null
  },
  "theme": {
    "pageBackground": "#hex",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "textColor": "#hex",
    "direction": "rtl"
  },
  "thankYou": { "title": string, "message": string },
  "blocks": [
    {
      "type": "hero"|"heading"|"subheading"|"paragraph"|"image"|"gallery"|"features"|"product_card"|"guarantee"|"testimonials"|"faq"|"badge"|"countdown"|"offer_countdown"|"order_counter"|"form"|"button"|"whatsapp_button"|"divider"|"spacer"|"banner",
      "props": object
    }
  ]
}

Rules:
- Arabic RTL copy, persuasive, professional, conversion-focused (landing page feel).
- Structure like a real product LP: hero → social proof/badge → product story → features → offer urgency → form.
- Include exactly ONE "form" block with fields: name, phone, city, address, quantity, notes (Arabic labels).
- Include hero + product_card + features + form at minimum. Prefer also: guarantee, testimonials, faq, offer_countdown when useful.
- features.props.items must be string[] (benefit bullets).
- faq.props.items = [{q,a}, ...]
- testimonials.props.items = [{name,text,rating?}, ...]
- Do NOT invent image URLs. Leave image/gallery src empty — real URLs are injected server-side.
- Keep 7–12 blocks. Prices as numbers.
- Use the merchant product name, price, compare price, features, and description faithfully.`;

    const user = `Merchant product brief:
${brief}

Product name: ${fallbackName}
Product description: ${description}
Price: ${input.price ?? 'infer or use 25000'}
Compare-at price (قبل التخفيض): ${input.compareAtPrice ?? 'optional — invent a realistic higher price if missing'}
Currency: ${input.currency ?? 'IQD'}
Platform / ad channel: ${input.platform || 'TIKTOK'}
Offer badge: ${input.offerBadge?.trim() || '(infer a short Arabic badge)'}
Known features (use these first): ${features.length ? features.join(' | ') : '(infer 4–6 strong bullets from brief)'}
Product images provided by merchant: ${images.length} image(s) — do not invent URLs
Extra notes: ${input.extraNotes?.trim() || '(none)'}`;

    try {
      const completion = await this.provider.chat(
        teamId,
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        {
          json: true,
          temperature: 0.35,
          maxTokens: 3200,
          persistUntilSuccess: true,
          correlationId: `instant-form-gen:${teamId}`,
        },
      );
      const parsed = this.parseJson(completion.content);
      return this.normalizeDocument(parsed, fallbackName, input, images, features, description);
    } catch (error) {
      this.logger.warn(
        `AI form generate failed teamId=${teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fallbackDocument(fallbackName, description, input, images, features);
    }
  }

  private cleanImages(raw?: string[]): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const item of raw) {
      const url = String(item || '').trim();
      if (!url || url.length > 800) continue;
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) continue;
      if (!out.includes(url)) out.push(url);
      if (out.length >= 10) break;
    }
    return out;
  }

  private cleanFeatures(raw?: string[]): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f) => String(f || '').trim())
      .filter((f) => f.length >= 2)
      .slice(0, 12);
  }

  private parseJson(raw: string): Record<string, unknown> {
    const trimmed = raw.replace(/```(?:json)?/gi, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) throw new BadRequestException('AI returned invalid form JSON');
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }

  private injectMediaBlocks(blocks: InstantFormBlock[], images: string[]): InstantFormBlock[] {
    if (!images.length) return blocks;
    const next = [...blocks];

    const galleryIdx = next.findIndex((b) => b.type === 'gallery');
    if (galleryIdx >= 0) {
      next[galleryIdx] = {
        ...next[galleryIdx]!,
        props: {
          ...next[galleryIdx]!.props,
          images,
          imageHeight: String(next[galleryIdx]!.props.imageHeight || '160px'),
          objectFit: String(next[galleryIdx]!.props.objectFit || 'cover'),
          borderRadius: String(next[galleryIdx]!.props.borderRadius || '12px'),
          columns: Number(next[galleryIdx]!.props.columns) || (images.length >= 3 ? 3 : 2),
        },
      };
    } else {
      const gallery = createDefaultBlock('gallery');
      gallery.props = {
        ...gallery.props,
        images,
        imageHeight: '160px',
        columns: images.length >= 3 ? 3 : 2,
      };
      const heroIdx = next.findIndex((b) => b.type === 'hero');
      const insertAt = heroIdx >= 0 ? heroIdx + 1 : 0;
      next.splice(insertAt, 0, gallery);
    }

    const imageIdx = next.findIndex((b) => b.type === 'image');
    if (imageIdx >= 0) {
      next[imageIdx] = {
        ...next[imageIdx]!,
        props: {
          ...next[imageIdx]!.props,
          src: images[0],
          alt: String(next[imageIdx]!.props.alt || 'صورة المنتج'),
        },
      };
    } else if (images[0]) {
      const image = createDefaultBlock('image');
      image.props = {
        ...image.props,
        src: images[0],
        alt: 'صورة المنتج',
        height: '280px',
      };
      const galleryPos = next.findIndex((b) => b.type === 'gallery');
      next.splice(galleryPos >= 0 ? galleryPos + 1 : 1, 0, image);
    }

    return next;
  }

  private normalizeDocument(
    raw: Record<string, unknown>,
    fallbackName: string,
    input: GenerateInstantFormInput,
    images: string[],
    features: string[],
    description: string,
  ): InstantFormDocument {
    const base = starterDocument(fallbackName);
    const productRaw = (raw.product && typeof raw.product === 'object' ? raw.product : {}) as Record<
      string,
      unknown
    >;
    const themeRaw = (raw.theme && typeof raw.theme === 'object' ? raw.theme : {}) as Record<string, unknown>;
    const thankYouRaw = (raw.thankYou && typeof raw.thankYou === 'object' ? raw.thankYou : {}) as Record<
      string,
      unknown
    >;

    const price =
      typeof input.price === 'number'
        ? input.price
        : typeof productRaw.price === 'number'
          ? productRaw.price
          : base.product?.price ?? 25000;

    const compareAtPrice =
      typeof input.compareAtPrice === 'number'
        ? input.compareAtPrice
        : typeof productRaw.compareAtPrice === 'number'
          ? productRaw.compareAtPrice
          : Math.round(price * 1.35);

    const blocksIn = Array.isArray(raw.blocks) ? raw.blocks : [];
    let blocks: InstantFormBlock[] = [];
    for (const item of blocksIn) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const type = String(row.type || '') as InstantFormBlockType;
      if (!ALLOWED_BLOCK_TYPES.has(type)) continue;
      const defaults = createDefaultBlock(type);
      const props =
        row.props && typeof row.props === 'object' ? (row.props as Record<string, unknown>) : {};
      blocks.push({
        id: createBlockId(type),
        type,
        props: { ...defaults.props, ...props },
        style: defaults.style,
      });
    }

    if (!blocks.some((b) => b.type === 'form')) {
      blocks.push({
        id: createBlockId('form'),
        type: 'form',
        props: {
          title: 'أكمل طلبك الآن',
          submitLabel: 'تأكيد الطلب',
          fields: this.normalizeFields(undefined),
        },
      });
    } else {
      blocks.forEach((b) => {
        if (b.type === 'form') {
          b.props = {
            ...b.props,
            fields: this.normalizeFields(b.props.fields),
            title: String(b.props.title || 'أكمل طلبك الآن'),
            submitLabel: String(b.props.submitLabel || 'تأكيد الطلب'),
          };
        }
      });
    }

    if (!blocks.some((b) => b.type === 'hero')) {
      blocks.unshift(createDefaultBlock('hero'));
    }

    const featuresBlock = blocks.find((b) => b.type === 'features');
    if (featuresBlock && features.length) {
      featuresBlock.props = {
        ...featuresBlock.props,
        title: String(featuresBlock.props.title || 'مميزات المنتج'),
        items: features,
      };
    } else if (!featuresBlock && features.length) {
      const fb = createDefaultBlock('features');
      fb.props = { title: 'مميزات المنتج', items: features };
      const heroIdx = blocks.findIndex((b) => b.type === 'hero');
      blocks.splice(heroIdx >= 0 ? heroIdx + 1 : 0, 0, fb);
    }

    const hero = blocks.find((b) => b.type === 'hero');
    if (hero) {
      hero.props = {
        ...hero.props,
        title: String(hero.props.title || fallbackName),
        subtitle: String(hero.props.subtitle || description.slice(0, 140)),
        badge: String(input.offerBadge || hero.props.badge || 'عرض خاص'),
      };
    }

    blocks = this.injectMediaBlocks(blocks, images);
    const finalBlocks = blocks.length ? blocks : base.blocks;

    return emptyDocument({
      theme: {
        ...base.theme,
        pageBackground: String(themeRaw.pageBackground || base.theme.pageBackground),
        primaryColor: String(themeRaw.primaryColor || base.theme.primaryColor),
        secondaryColor: String(themeRaw.secondaryColor || base.theme.secondaryColor),
        textColor: String(themeRaw.textColor || base.theme.textColor),
        direction: 'rtl',
      },
      thankYou: {
        ...base.thankYou,
        title: String(thankYouRaw.title || 'تم استلام طلبك بنجاح'),
        message: String(
          thankYouRaw.message || 'شكراً لك! سيتواصل معك فريقنا عبر واتساب لتأكيد الطلب قريباً.',
        ),
      },
      product: {
        ...base.product,
        name: String(productRaw.name || input.productName || fallbackName),
        description: String(productRaw.description || description).slice(0, 2000),
        price,
        compareAtPrice,
        discountLabel:
          productRaw.discountLabel == null
            ? compareAtPrice > price
              ? `وفر ${Math.round(((compareAtPrice - price) / compareAtPrice) * 100)}%`
              : base.product?.discountLabel
            : String(productRaw.discountLabel),
        currency: String(productRaw.currency || input.currency || 'IQD'),
        badge: String(input.offerBadge || productRaw.badge || base.product?.badge || 'الأكثر مبيعاً'),
        salesCount:
          typeof productRaw.salesCount === 'number' ? productRaw.salesCount : base.product?.salesCount ?? 128,
        rating: typeof productRaw.rating === 'number' ? productRaw.rating : base.product?.rating ?? 4.9,
        images,
      },
      blocks: finalBlocks,
    });
  }

  private normalizeFields(raw: unknown): InstantFormField[] {
    if (!Array.isArray(raw) || raw.length === 0) return defaultLeadFormFields();
    const out: InstantFormField[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const f = item as Record<string, unknown>;
      out.push({
        id: createFieldId(String(f.type || 'field')),
        type: (String(f.type || 'text') as InstantFormField['type']) || 'text',
        label: String(f.label || 'حقل'),
        placeholder: f.placeholder == null ? undefined : String(f.placeholder),
        required: Boolean(f.required),
        defaultValue: f.defaultValue == null ? undefined : String(f.defaultValue),
        options: Array.isArray(f.options) ? f.options.map(String) : undefined,
      });
    }
    return out.length ? out : defaultLeadFormFields();
  }

  private fallbackDocument(
    name: string,
    description: string,
    input: GenerateInstantFormInput,
    images: string[],
    features: string[],
  ): InstantFormDocument {
    const doc = starterDocument(name);
    const price = input.price ?? doc.product?.price ?? 25000;
    const compareAtPrice = input.compareAtPrice ?? Math.round(price * 1.35);
    doc.product = {
      ...doc.product,
      name,
      description: description.slice(0, 2000),
      price,
      compareAtPrice,
      discountLabel:
        compareAtPrice > price
          ? `وفر ${Math.round(((compareAtPrice - price) / compareAtPrice) * 100)}%`
          : doc.product?.discountLabel,
      currency: input.currency || 'IQD',
      badge: input.offerBadge || 'عرض خاص',
      salesCount: 128,
      rating: 4.9,
      images,
    };

    const hero = doc.blocks.find((b) => b.type === 'hero');
    if (hero) {
      hero.props = {
        ...hero.props,
        title: name,
        subtitle: description.slice(0, 140),
        badge: input.offerBadge || 'عرض خاص',
      };
    }

    const featuresBlock = doc.blocks.find((b) => b.type === 'features');
    if (featuresBlock) {
      featuresBlock.props = {
        title: 'لماذا تختار هذا العرض؟',
        items:
          features.length > 0
            ? features
            : ['جودة عالية مضمونة', 'توصيل سريع لكل المحافظات', 'دعم مباشر عبر واتساب', 'ضمان استرجاع خلال 7 أيام'],
      };
    }

    if (!doc.blocks.some((b) => b.type === 'guarantee')) {
      const g = createDefaultBlock('guarantee');
      g.props = {
        title: 'ضمان رضا العميل',
        text: 'نقدّم ضمان استرجاع خلال 7 أيام إذا لم يناسبك المنتج.',
      };
      const formIdx = doc.blocks.findIndex((b) => b.type === 'form');
      doc.blocks.splice(formIdx >= 0 ? formIdx : doc.blocks.length, 0, g);
    }

    if (!doc.blocks.some((b) => b.type === 'offer_countdown')) {
      const c = createDefaultBlock('offer_countdown');
      const formIdx = doc.blocks.findIndex((b) => b.type === 'form');
      doc.blocks.splice(formIdx >= 0 ? formIdx : doc.blocks.length, 0, c);
    }

    doc.blocks = this.injectMediaBlocks(doc.blocks, images);
    return doc;
  }
}
