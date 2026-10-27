import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalH2, LegalLayout, LegalList, LegalMail, LegalP } from '@/components/legal/legal-layout';
import { COMPANY_LEGAL, LEGAL_LAST_UPDATED, LEGAL_ROUTES, companyFullAddress } from '@/lib/company-info';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'شروط الخدمة — Terms of Service',
  description:
    'Terms of Service of ChatLoora (Mey Architects, PC): TikTok ads management, WhatsApp conversion tracking, WhatsApp inbox, instant forms and online store.',
  alternates: { canonical: `${baseUrl}${LEGAL_ROUTES.terms}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ChatLoora — Terms of Service',
    description: 'The terms that govern your use of ChatLoora, operated by Mey Architects, PC.',
    url: `${baseUrl}${LEGAL_ROUTES.terms}`,
    type: 'article',
  },
};

const { legalName, tradeName, supportEmail } = COMPANY_LEGAL;

function ArabicTerms() {
  return (
    <>
      <LegalP>
        تحكم هذه الشروط استخدامك لمنصة <strong>{tradeName}</strong> التي تشغّلها شركة <strong>{legalName}</strong>. باستخدامك للمنصة
        أو إنشاء حساب فإنك توافق على هذه الشروط وعلى <Link href={LEGAL_ROUTES.privacy} className="text-violet-700 hover:underline">سياسة الخصوصية</Link>.
      </LegalP>

      <LegalH2>1. وصف الخدمة</LegalH2>
      <LegalList>
        <li>إدارة إعلانات تيك توك عبر TikTok Marketing API، مع حصر مواضع ظهور الإعلانات على تيك توك فقط.</li>
        <li>تتبع التحويلات القادمة من واتساب وإرسال أحداث التحويل إلى تيك توك.</li>
        <li>صندوق وارد واتساب لقراءة المحادثات والرد عليها من لوحة التحكم.</li>
        <li>النماذج الفورية والمتجر الإلكتروني لاستقبال طلبات عملائك.</li>
      </LegalList>

      <LegalH2>2. الحسابات والأهلية</LegalH2>
      <LegalP>
        يجب أن يكون عمرك 18 عاماً أو أكثر، وأن تستخدم المنصة لأغراض تجارية. أنت مسؤول عن صحة بيانات حسابك وعن الحفاظ على سرية
        كلمة المرور وعن كل نشاط يتم من خلال حسابك.
      </LegalP>

      <LegalH2>3. مسؤوليات العميل</LegalH2>
      <LegalList>
        <li>الالتزام بسياسات الإعلان في تيك توك (TikTok Advertising Policies)، وسياسات واتساب و Meta للأعمال، والقوانين المحلية المعمول بها.</li>
        <li>الحصول على الموافقات اللازمة من عملائك النهائيين قبل مراسلتهم أو معالجة بياناتهم أو إرسال أحداث التحويل الخاصة بهم.</li>
        <li>أنت وحدك المسؤول عن محتوى إعلاناتك ورسائلك ومنتجاتك.</li>
      </LegalList>

      <LegalH2>4. الاشتراكات والمدفوعات</LegalH2>
      <LegalList>
        <li>تُشترى الاشتراكات من خلال الموقع الإلكتروني فقط، وتتم معالجة الدفع عبر مزوّد الدفع Wayl.</li>
        <li>قد تتجدد الاشتراكات تلقائياً إذا كان التجديد التلقائي مفعّلاً، ويمكنك إيقافه من إعدادات الحساب على الموقع قبل موعد التجديد.</li>
        <li>تُرد المبالغ وفق ما يفرضه القانون المعمول به، أو وفق تقديرنا.</li>
        <li>رصيد الإنفاق الإعلاني على تيك توك يُدفع مباشرةً إلى تيك توك وليس إلى {tradeName}.</li>
      </LegalList>

      <LegalH2>5. الاستخدام المقبول</LegalH2>
      <LegalP>
        يُمنع استخدام المنصة لإرسال رسائل مزعجة (Spam) أو محتوى غير قانوني أو مضلل أو احتيالي، أو لانتهاك حقوق الآخرين، أو لمحاولة
        اختراق المنصة أو تعطيلها أو إساءة استخدام واجهاتها البرمجية، أو لتجاوز حدود الباقة أو قيود منصات الطرف الثالث.
      </LegalP>

      <LegalH2>6. خدمات الطرف الثالث</LegalH2>
      <LegalP>
        تعتمد المنصة على خدمات من أطراف ثالثة مثل تيك توك و Meta/واتساب. قد تغيّر هذه الجهات واجهاتها أو سياساتها أو توقف بعض
        الميزات في أي وقت، ولسنا مسؤولين عن ذلك أو عن قرارات هذه الجهات بشأن حساباتك أو إعلاناتك.
      </LegalP>

      <LegalH2>7. توفر الخدمة</LegalH2>
      <LegalP>نسعى لتوفير الخدمة باستمرار، لكنها تُقدَّم «كما هي» وقد تتوقف مؤقتاً للصيانة أو لأسباب خارجة عن إرادتنا.</LegalP>

      <LegalH2>8. حدود المسؤولية</LegalH2>
      <LegalP>
        إلى أقصى حد يسمح به القانون، لا نتحمل المسؤولية عن الأضرار غير المباشرة أو التبعية أو خسارة الأرباح أو البيانات أو نتائج
        الإعلانات. وفي جميع الأحوال لا تتجاوز مسؤوليتنا الإجمالية المبالغ التي دفعتها لنا خلال الأشهر الثلاثة السابقة للمطالبة.
      </LegalP>

      <LegalH2>9. الإنهاء</LegalH2>
      <LegalP>يمكنك التوقف عن استخدام المنصة في أي وقت. ويحق لنا تعليق الحساب أو إنهاؤه عند مخالفة هذه الشروط أو السياسات المذكورة.</LegalP>

      <LegalH2>10. حذف الحساب</LegalH2>
      <LegalP>
        يمكنك حذف حسابك في أي وقت من الإعدادات ← الحساب ← حذف الحساب. التفاصيل في{' '}
        <Link href={LEGAL_ROUTES.accountDeletion} className="text-violet-700 hover:underline">صفحة حذف الحساب</Link>.
      </LegalP>

      <LegalH2>11. القانون الحاكم</LegalH2>
      <LegalP>تخضع هذه الشروط لقوانين ولاية ألاسكا، الولايات المتحدة الأمريكية.</LegalP>

      <LegalH2>12. التواصل</LegalH2>
      <LegalP>
        {legalName} — <span dir="ltr">{companyFullAddress()}</span> — <LegalMail email={supportEmail} />
      </LegalP>
    </>
  );
}

function EnglishTerms() {
  return (
    <>
      <LegalP>
        These Terms govern your use of <strong>{tradeName}</strong>, operated by <strong>{legalName}</strong>. By using the service or
        creating an account you agree to these Terms and to our{' '}
        <Link href={LEGAL_ROUTES.privacy} className="text-violet-700 hover:underline">Privacy Policy</Link>.
      </LegalP>

      <LegalH2>1. The service</LegalH2>
      <LegalList>
        <li>TikTok ads management via the TikTok Marketing API, limited to TikTok placements only.</li>
        <li>WhatsApp conversion tracking, with conversion events sent to TikTok.</li>
        <li>A WhatsApp inbox to read and reply to conversations from the dashboard.</li>
        <li>Instant forms and an online store to receive orders from your customers.</li>
      </LegalList>

      <LegalH2>2. Accounts and eligibility</LegalH2>
      <LegalP>
        You must be at least 18 years old and use the service for business purposes. You are responsible for the accuracy of your
        account information, for keeping your password confidential, and for all activity under your account.
      </LegalP>

      <LegalH2>3. Customer responsibilities</LegalH2>
      <LegalList>
        <li>Comply with the TikTok Advertising Policies, WhatsApp / Meta Business policies and applicable local law.</li>
        <li>Obtain any consent required from your end customers before messaging them, processing their data or sending their conversion events.</li>
        <li>You are solely responsible for the content of your ads, messages and products.</li>
      </LegalList>

      <LegalH2>4. Subscriptions and payments</LegalH2>
      <LegalList>
        <li>Subscriptions are purchased on the website only; payments are processed by Wayl.</li>
        <li>Subscriptions may renew automatically when auto-renew is enabled; you can turn it off in your account settings on the website before the renewal date.</li>
        <li>Refunds are provided as required by applicable law or at our discretion.</li>
        <li>TikTok ad spend is paid directly to TikTok and not to {tradeName}.</li>
      </LegalList>

      <LegalH2>5. Acceptable use</LegalH2>
      <LegalP>
        You may not use the service to send spam or illegal, misleading or fraudulent content, to infringe others&apos; rights, to attempt
        to breach, disrupt or abuse the service or its APIs, or to circumvent plan limits or third-party platform restrictions.
      </LegalP>

      <LegalH2>6. Third-party services</LegalH2>
      <LegalP>
        The service relies on third parties such as TikTok and Meta / WhatsApp. They may change their APIs or policies or discontinue
        features at any time. We are not responsible for such changes or for their decisions about your accounts or ads.
      </LegalP>

      <LegalH2>7. Availability</LegalH2>
      <LegalP>We aim to keep the service available, but it is provided &quot;as is&quot; and may be interrupted for maintenance or reasons beyond our control.</LegalP>

      <LegalH2>8. Limitation of liability</LegalH2>
      <LegalP>
        To the maximum extent permitted by law, we are not liable for indirect or consequential damages, lost profits, lost data or ad
        results. Our total liability is limited to the amounts you paid us in the three months before the claim.
      </LegalP>

      <LegalH2>9. Termination</LegalH2>
      <LegalP>You may stop using the service at any time. We may suspend or terminate accounts that violate these Terms or the policies above.</LegalP>

      <LegalH2>10. Account deletion</LegalH2>
      <LegalP>
        You can delete your account at any time in Settings → Account → Delete account. See{' '}
        <Link href={LEGAL_ROUTES.accountDeletion} className="text-violet-700 hover:underline">Account deletion</Link> for details.
      </LegalP>

      <LegalH2>11. Governing law</LegalH2>
      <LegalP>These Terms are governed by the laws of the State of Alaska, USA.</LegalP>

      <LegalH2>12. Contact</LegalH2>
      <LegalP>
        {legalName} — {companyFullAddress()} — <LegalMail email={supportEmail} />
      </LegalP>
    </>
  );
}

export default function TermsPage() {
  return (
    <LegalLayout
      titleAr="شروط الخدمة"
      titleEn="Terms of Service"
      lastUpdated={LEGAL_LAST_UPDATED}
      arabic={<ArabicTerms />}
      english={<EnglishTerms />}
    />
  );
}
