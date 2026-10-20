import { InstantFormAdPlatform } from '@watsapp/database';
import { InstantFormDocument, starterDocument } from './instant-form.document';

export type InstantFormTemplate = {
  key: string;
  nameAr: string;
  nameEn: string;
  category: string;
  descriptionAr: string;
  build: () => InstantFormDocument;
};

function withHero(title: string, subtitle: string, productName: string, price: number): InstantFormDocument {
  const doc = starterDocument(productName);
  doc.product = { ...doc.product, name: productName, price, compareAtPrice: Math.round(price * 1.35), currency: 'IQD' };
  const hero = doc.blocks.find((b) => b.type === 'hero');
  if (hero) {
    hero.props = { title, subtitle, badge: 'عرض خاص' };
  }
  return doc;
}

export const INSTANT_FORM_TEMPLATES: InstantFormTemplate[] = [
  {
    key: 'dental',
    nameAr: 'عيادات الأسنان',
    nameEn: 'Dental Clinics',
    category: 'clinics',
    descriptionAr: 'حجز مواعيد وعيادات أسنان',
    build: () => withHero('ابتسامة أحلامك تبدأ هنا', 'احجز استشارة مجانية اليوم', 'استشارة أسنان', 0),
  },
  {
    key: 'medical',
    nameAr: 'العيادات الطبية',
    nameEn: 'Medical Clinics',
    category: 'clinics',
    descriptionAr: 'حجوزات طبية عامة',
    build: () => withHero('احجز موعدك الطبي بسهولة', 'فريق أطباء متخصص', 'موعد طبي', 0),
  },
  {
    key: 'restaurant',
    nameAr: 'المطاعم',
    nameEn: 'Restaurants',
    category: 'food',
    descriptionAr: 'طلبات طعام وتوصيل',
    build: () => withHero('أشهى الأطباق إلى بابك', 'اطلب الآن ووفّر على التوصيل', 'وجبة مميزة', 15000),
  },
  {
    key: 'realestate',
    nameAr: 'العقارات',
    nameEn: 'Real Estate',
    category: 'services',
    descriptionAr: 'استفسارات عقارية',
    build: () => withHero('عقارك المثالي بانتظارك', 'اترك بياناتك وسنتواصل فوراً', 'استفسار عقاري', 0),
  },
  {
    key: 'store',
    nameAr: 'المتاجر',
    nameEn: 'Stores',
    category: 'commerce',
    descriptionAr: 'متجر إلكتروني عام',
    build: () => withHero('تسوق أذكى وأسرع', 'عروض يومية على أفضل المنتجات', 'منتج مميز', 29900),
  },
  {
    key: 'fashion',
    nameAr: 'الملابس',
    nameEn: 'Fashion',
    category: 'commerce',
    descriptionAr: 'أزياء وموضة',
    build: () => withHero('أحدث صيحات الموضة', 'اطلب مقاسك الآن', 'قطعة أزياء', 45000),
  },
  {
    key: 'electronics',
    nameAr: 'الإلكترونيات',
    nameEn: 'Electronics',
    category: 'commerce',
    descriptionAr: 'أجهزة وإكسسوارات',
    build: () => withHero('تقنية بأسعار منافسة', 'ضمان أصلي وتوصيل سريع', 'جهاز إلكتروني', 199000),
  },
  {
    key: 'beauty',
    nameAr: 'مستحضرات التجميل',
    nameEn: 'Beauty',
    category: 'commerce',
    descriptionAr: 'تجميل وعناية',
    build: () => withHero('جمالك يبدأ من هنا', 'منتجات أصلية وآمنة', 'منتج تجميل', 22000),
  },
  {
    key: 'courses',
    nameAr: 'الدورات',
    nameEn: 'Courses',
    category: 'education',
    descriptionAr: 'تسجيل دورات تدريبية',
    build: () => withHero('طوّر مهاراتك اليوم', 'سجّل في الدورة الآن', 'دورة تدريبية', 75000),
  },
  {
    key: 'services',
    nameAr: 'الخدمات',
    nameEn: 'Services',
    category: 'services',
    descriptionAr: 'طلب خدمة عامة',
    build: () => withHero('احصل على خدمتك فوراً', 'املأ النموذج وسنتواصل', 'طلب خدمة', 0),
  },
  {
    key: 'cars',
    nameAr: 'السيارات',
    nameEn: 'Cars',
    category: 'services',
    descriptionAr: 'معارض وخدمات سيارات',
    build: () => withHero('سيارتك القادمة هنا', 'استفسر الآن عن أفضل العروض', 'استفسار سيارة', 0),
  },
  {
    key: 'delivery',
    nameAr: 'التوصيل',
    nameEn: 'Delivery',
    category: 'services',
    descriptionAr: 'طلبات توصيل سريع',
    build: () => withHero('توصيل خلال ساعات', 'اطلب والباقي علينا', 'طلب توصيل', 5000),
  },
];

export function getTemplateDocument(key?: string | null): InstantFormDocument {
  const tpl = INSTANT_FORM_TEMPLATES.find((t) => t.key === key);
  return tpl ? tpl.build() : starterDocument();
}

export const AD_PLATFORMS: InstantFormAdPlatform[] = [
  'TIKTOK',
  'FACEBOOK',
  'INSTAGRAM',
  'GOOGLE',
  'SNAPCHAT',
  'OTHER',
];
