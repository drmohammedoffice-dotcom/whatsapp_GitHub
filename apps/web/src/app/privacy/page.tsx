import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalH2, LegalH3, LegalLayout, LegalList, LegalMail, LegalP } from '@/components/legal/legal-layout';
import { COMPANY_LEGAL, LEGAL_LAST_UPDATED, LEGAL_ROUTES, companyFullAddress } from '@/lib/company-info';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — Privacy Policy',
  description:
    'Privacy Policy of ChatLoora (Mey Architects, PC): what data we collect for TikTok ads management, WhatsApp conversion tracking, the WhatsApp inbox, instant forms and the online store, how we use and share it, retention and your rights.',
  alternates: { canonical: `${baseUrl}${LEGAL_ROUTES.privacy}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ChatLoora — Privacy Policy',
    description: 'How ChatLoora (Mey Architects, PC) collects, uses, shares and protects personal data.',
    url: `${baseUrl}${LEGAL_ROUTES.privacy}`,
    type: 'article',
  },
};

const { legalName, tradeName, privacyEmail } = COMPANY_LEGAL;

function ArabicPolicy() {
  return (
    <>
      <LegalP>
        توضّح هذه السياسة كيف تجمع منصة <strong>{tradeName}</strong> («تشات لورا»، «نحن») البيانات الشخصية وتستخدمها
        وتشاركها وتحميها عند استخدامك لموقعنا وتطبيقاتنا على الهاتف والخدمات المرتبطة بها.
      </LegalP>

      <LegalH2>1. من نحن (المتحكم بالبيانات)</LegalH2>
      <LegalP>
        تُشغَّل المنصة من قبل شركة <strong>{legalName}</strong> (الاسم التجاري: {tradeName})، وعنوانها:{' '}
        <span dir="ltr">{companyFullAddress()}</span>. للتواصل بخصوص الخصوصية: <LegalMail email={privacyEmail} />.
      </LegalP>
      <LegalP>
        بالنسبة لبيانات حسابك وبيانات استخدامك للمنصة، نحن المتحكم بالبيانات. أما بيانات العملاء النهائيين للتاجر (مثل
        أرقام هواتف من يراسلونه أو طلباتهم) فالتاجر هو المتحكم بها، ونعمل نحن كمعالج للبيانات نيابةً عنه ووفق تعليماته.
      </LegalP>

      <LegalH2>2. البيانات التي نجمعها</LegalH2>
      <LegalH3>أ) بيانات الحساب</LegalH3>
      <LegalList>
        <li>الاسم، البريد الإلكتروني، رقم الهاتف، كلمة المرور (نخزّنها مشفّرة بطريقة التجزئة hash ولا نطّلع عليها)، واسم الفريق / مساحة العمل.</li>
        <li>رموز التحقق ورموز الدخول لمرة واحدة (OTP) التي نرسلها عبر واتساب أو عبر البريد الإلكتروني (من خلال مزوّد البريد Resend).</li>
      </LegalList>

      <LegalH3>ب) بيانات ربط واتساب للأعمال</LegalH3>
      <LegalList>
        <li>يربط العميل رقم واتساب الخاص به بنفسه، إما بمسح رمز QR أو عبر WhatsApp Cloud API، ونحفظ بيانات الاتصال اللازمة لتشغيل الربط (مشفّرة).</li>
        <li>
          <strong>أرقام صندوق الوارد (Inbox):</strong> نخزّن المحادثات وجهات الاتصال والوسائط الخاصة بمحادثات العميل حتى
          يتمكن من قراءتها والرد عليها من لوحة التحكم.
        </li>
        <li>
          <strong>أرقام التتبع (Tracking):</strong> لا نخزّن محتوى الرسائل ولا الوسائط. نقرأ الرسالة الواردة فقط لاكتشاف
          مرجع النقرة (click reference)، ثم نخزّن رقم هاتف المرسل وبيانات النقرة / التحويل الوصفية فقط.
        </li>
      </LegalList>

      <LegalH3>ج) بيانات تيك توك</LegalH3>
      <LegalList>
        <li>رموز الوصول OAuth لحسابات TikTok For Business والحسابات الإعلانية التي يربطها العميل، ومعرّفات المعلنين (Advertiser IDs).</li>
        <li>بيانات الحملات والإعلانات والتقارير التي نسترجعها عبر TikTok Marketing API بطلب من العميل.</li>
        <li>بيانات النقر على روابط إعادة التوجيه الخاصة بالتتبع لدينا: معرّف النقرة ttclid، عنوان IP، نوع المتصفح/الجهاز (User Agent)، ووقت النقرة.</li>
        <li>
          أحداث التحويل التي نرسلها إلى TikTok Events API، ويكون فيها رقم هاتف العميل النهائي <strong>مُجزّأً (SHA-256)</strong>{' '}
          وليس نصاً صريحاً. التاجر هو المتحكم ببيانات عملائه، ونحن نعمل كمعالج.
        </li>
      </LegalList>

      <LegalH3>د) النماذج الفورية والمتجر الإلكتروني</LegalH3>
      <LegalList>
        <li>تفاصيل الطلبات التي يرسلها العملاء النهائيون للتاجر: الاسم، رقم الهاتف، العنوان، والمنتجات المطلوبة. نخزّنها لصالح التاجر.</li>
      </LegalList>

      <LegalH3>هـ) المدفوعات</LegalH3>
      <LegalList>
        <li>
          تتم معالجة مدفوعات الاشتراكات على الموقع عبر مزوّد الدفع <strong>Wayl</strong>. لا نخزّن بيانات البطاقات. نحتفظ بسجلات
          الدفع والفواتير لأغراض المحاسبة.
        </li>
      </LegalList>

      <LegalH3>و) البيانات التقنية والدعم</LegalH3>
      <LegalList>
        <li>السجلات التقنية (logs)، عنوان IP، نوع الجهاز والمتصفح.</li>
        <li>ملفات تعريف الارتباط (Cookies) والتخزين المحلي (localStorage) لحفظ جلسة تسجيل الدخول والتفضيلات (مثل اللغة) فقط.</li>
        <li>الرسائل التي ترسلها إلى الدعم أو عبر البريد داخل المنصة.</li>
      </LegalList>

      <LegalH2>3. لماذا نستخدم البيانات والأساس القانوني</LegalH2>
      <LegalList>
        <li><strong>تقديم الخدمة وتنفيذ العقد:</strong> إنشاء الحساب، ربط واتساب وتيك توك، إدارة الإعلانات، تتبع التحويلات، صندوق الوارد، النماذج والمتجر.</li>
        <li><strong>الأمان ومنع الاحتيال:</strong> التحقق برموز OTP، حماية الحسابات، سجلات التدقيق (مصلحة مشروعة).</li>
        <li><strong>الفوترة والالتزامات القانونية:</strong> معالجة الاشتراكات والاحتفاظ بالفواتير وفق القانون.</li>
        <li><strong>الدعم والتواصل:</strong> الرد على استفساراتك وإرسال إشعارات تشغيلية ضرورية.</li>
        <li><strong>الموافقة:</strong> عندما يتطلب القانون ذلك، ويمكنك سحبها في أي وقت.</li>
      </LegalList>

      <LegalH2>4. مشاركة البيانات</LegalH2>
      <LegalP>لا نبيع البيانات الشخصية. نشارك البيانات فقط مع الجهات اللازمة لتشغيل الخدمة:</LegalP>
      <LegalList>
        <li><strong>TikTok</strong> — عبر Marketing API و Events API (بيانات الحملات وأحداث التحويل مع أرقام هواتف مُجزّأة).</li>
        <li><strong>Meta / WhatsApp</strong> — لتشغيل ربط واتساب وإرسال الرسائل واستقبالها.</li>
        <li><strong>Wayl</strong> — لمعالجة مدفوعات الاشتراك على الموقع.</li>
        <li><strong>Resend</strong> — لإرسال رسائل البريد الإلكتروني (مثل رموز التحقق).</li>
        <li><strong>مزوّد الاستضافة Contabo</strong> — خوادم داخل الاتحاد الأوروبي.</li>
        <li>السلطات المختصة عندما يفرض القانون ذلك.</li>
      </LegalList>
      <LegalP>لا يحتوي تطبيق الهاتف على أي أدوات (SDK) إعلانية أو تتبع إعلاني.</LegalP>

      <LegalH2>5. مدة الاحتفاظ بالبيانات</LegalH2>
      <LegalList>
        <li>بيانات الحساب ومحتوى مساحة العمل: طوال فترة نشاط الحساب.</li>
        <li>عند حذف الحساب: تُحذف البيانات أو تُجهَّل فوراً (راجع <Link href={LEGAL_ROUTES.accountDeletion} className="text-violet-700 hover:underline">صفحة حذف الحساب</Link>).</li>
        <li>سجلات الدفع والفواتير: تُحفظ للمدة التي يفرضها القانون لأغراض المحاسبة.</li>
        <li>سجلات الأمان والتدقيق: حتى 12 شهراً.</li>
        <li>النسخ الاحتياطية: تُدوَّر وتُحذف خلال 30 يوماً.</li>
      </LegalList>

      <LegalH2>6. حقوقك</LegalH2>
      <LegalP>
        يحق لك الوصول إلى بياناتك، وتصحيحها، وحذفها، وطلب نسخة منها (تصدير)، والاعتراض على معالجتها أو تقييدها. يمكنك حذف
        حسابك مباشرة من الإعدادات ← الحساب ← حذف الحساب، أو مراسلتنا على <LegalMail email={privacyEmail} /> من البريد المسجّل
        في حسابك. إذا كنت عميلاً نهائياً لأحد التجار، فيُرجى التواصل مع التاجر أولاً لأنه المتحكم ببياناتك، وسنساعده في تلبية طلبك.
      </LegalP>

      <LegalH2>7. الأطفال</LegalH2>
      <LegalP>الخدمة مخصّصة للأعمال وليست موجّهة لمن هم دون 18 عاماً، ولا نجمع بياناتهم عن قصد.</LegalP>

      <LegalH2>8. نقل البيانات دولياً</LegalH2>
      <LegalP>
        تُستضاف بياناتنا على خوادم في الاتحاد الأوروبي، وقد تُعالَج لدى مزوّدينا (مثل TikTok و Meta و Resend) في دول أخرى منها
        الولايات المتحدة. نعتمد ضمانات تعاقدية مناسبة عند نقل البيانات.
      </LegalP>

      <LegalH2>9. الأمان</LegalH2>
      <LegalP>
        نستخدم اتصالاً مشفّراً (TLS) لكل الاتصالات، ونشفّر بيانات اعتماد واتساب ورموز الوصول (tokens) أثناء التخزين، ونخزّن كلمات
        المرور بطريقة التجزئة، ونطبّق عزلاً بين مساحات العمل وصلاحيات وصول. لا يوجد نظام آمن بنسبة 100%، لكننا نعمل باستمرار على حماية بياناتك.
      </LegalP>

      <LegalH2>10. التغييرات على هذه السياسة</LegalH2>
      <LegalP>قد نحدّث هذه السياسة من وقت لآخر، وسنغيّر تاريخ «آخر تحديث» أعلاه، ونُعلمك بالتغييرات الجوهرية داخل المنصة أو عبر البريد.</LegalP>

      <LegalH2>11. التواصل</LegalH2>
      <LegalP>
        {legalName} — <span dir="ltr">{companyFullAddress()}</span> — <LegalMail email={privacyEmail} />
      </LegalP>
    </>
  );
}

function EnglishPolicy() {
  return (
    <>
      <LegalP>
        This Privacy Policy explains how <strong>{tradeName}</strong> (&quot;we&quot;, &quot;us&quot;) collects, uses, shares and protects
        personal data when you use our website, mobile apps and related services.
      </LegalP>

      <LegalH2>1. Who we are (data controller)</LegalH2>
      <LegalP>
        The service is operated by <strong>{legalName}</strong> (trade name: {tradeName}), {companyFullAddress()}. Privacy contact:{' '}
        <LegalMail email={privacyEmail} />.
      </LegalP>
      <LegalP>
        We are the controller of your account and usage data. For the data of a merchant&apos;s end customers (for example the phone
        numbers of people who message the merchant, or their orders) the merchant is the controller and ChatLoora acts as a
        processor on the merchant&apos;s behalf and instructions.
      </LegalP>

      <LegalH2>2. Data we collect</LegalH2>
      <LegalH3>a) Account data</LegalH3>
      <LegalList>
        <li>Name, email, phone number, password (stored only in hashed form), and team / workspace name.</li>
        <li>Authentication and one-time passcodes (OTP) we send via WhatsApp or email (through our email provider Resend).</li>
      </LegalList>

      <LegalH3>b) WhatsApp Business connection data</LegalH3>
      <LegalList>
        <li>The customer links their own WhatsApp number, either by scanning a QR code or via the WhatsApp Cloud API. We store the connection credentials required to operate the link (encrypted).</li>
        <li>
          <strong>Inbox numbers:</strong> we store the conversations, contacts and media of the customer&apos;s chats so the customer
          can read and reply from the dashboard.
        </li>
        <li>
          <strong>Tracking numbers:</strong> we do <strong>not</strong> store message content or media. We only read the incoming
          message to detect a click reference, and store the sender phone number plus click / conversion metadata.
        </li>
      </LegalList>

      <LegalH3>c) TikTok data</LegalH3>
      <LegalList>
        <li>OAuth tokens for the customer&apos;s TikTok For Business and ad accounts, and advertiser IDs.</li>
        <li>Campaign, ad and report data retrieved via the TikTok Marketing API at the customer&apos;s request.</li>
        <li>Ad clicks on our tracking redirect links: ttclid, IP address, user agent and timestamp.</li>
        <li>
          Conversion events sent to the TikTok Events API, with the end customer&apos;s phone number <strong>hashed (SHA-256)</strong>.
          The merchant is the controller of their end customers&apos; data; ChatLoora acts as processor.
        </li>
      </LegalList>

      <LegalH3>d) Instant forms and online store</LegalH3>
      <LegalList>
        <li>Order details submitted by the merchant&apos;s end customers (name, phone, address, order items), stored for the merchant.</li>
      </LegalList>

      <LegalH3>e) Payments</LegalH3>
      <LegalList>
        <li>
          Subscription payments on our website are processed by <strong>Wayl</strong>. We do not store card data. We keep payment
          records and invoices for accounting.
        </li>
      </LegalList>

      <LegalH3>f) Technical and support data</LegalH3>
      <LegalList>
        <li>Logs, IP address, device and browser information.</li>
        <li>Cookies and localStorage used only for the login session and preferences (such as language).</li>
        <li>Messages you send to support or through the in-platform webmail.</li>
      </LegalList>

      <LegalH2>3. Purposes and legal bases</LegalH2>
      <LegalList>
        <li><strong>Providing the service (contract):</strong> account creation, WhatsApp and TikTok connections, ads management, conversion tracking, inbox, forms and store.</li>
        <li><strong>Security and fraud prevention (legitimate interest):</strong> OTP verification, account protection, audit logs.</li>
        <li><strong>Billing and legal obligations:</strong> processing subscriptions and keeping invoices as required by law.</li>
        <li><strong>Support and communication:</strong> answering your requests and sending necessary service notices.</li>
        <li><strong>Consent:</strong> where required by law; you may withdraw it at any time.</li>
      </LegalList>

      <LegalH2>4. Sharing</LegalH2>
      <LegalP>We do not sell personal data. We share data only with the parties needed to run the service:</LegalP>
      <LegalList>
        <li><strong>TikTok</strong> — Marketing API and Events API (campaign data and conversion events with hashed phone numbers).</li>
        <li><strong>Meta / WhatsApp</strong> — to operate WhatsApp connections and send / receive messages.</li>
        <li><strong>Wayl</strong> — to process subscription payments on the website.</li>
        <li><strong>Resend</strong> — to send emails (such as verification codes).</li>
        <li><strong>Contabo</strong> — our hosting provider (servers in the EU).</li>
        <li>Competent authorities where required by law.</li>
      </LegalList>
      <LegalP>Our mobile app contains no advertising SDKs and no ad tracking.</LegalP>

      <LegalH2>5. Retention</LegalH2>
      <LegalList>
        <li>Account data and workspace content: while the account is active.</li>
        <li>On account deletion: deleted or anonymized immediately (see <Link href={LEGAL_ROUTES.accountDeletion} className="text-violet-700 hover:underline">Account deletion</Link>).</li>
        <li>Payment records and invoices: kept as required by law for accounting.</li>
        <li>Security / audit logs: up to 12 months.</li>
        <li>Backups: rotated within 30 days.</li>
      </LegalList>

      <LegalH2>6. Your rights</LegalH2>
      <LegalP>
        You can access, correct, delete and export your data, and object to or restrict its processing. You can delete your account
        directly in Settings → Account → Delete account, or email <LegalMail email={privacyEmail} /> from your account email. If you
        are an end customer of a merchant, please contact the merchant first (the controller of your data); we will assist them.
      </LegalP>

      <LegalH2>7. Children</LegalH2>
      <LegalP>The service is intended for businesses and is not directed to anyone under 18. We do not knowingly collect their data.</LegalP>

      <LegalH2>8. International transfers</LegalH2>
      <LegalP>
        Our data is hosted on servers in the European Union and may be processed by our providers (such as TikTok, Meta and Resend)
        in other countries, including the United States. We rely on appropriate contractual safeguards for such transfers.
      </LegalP>

      <LegalH2>9. Security</LegalH2>
      <LegalP>
        All traffic uses TLS. WhatsApp credentials and access tokens are encrypted at rest, passwords are hashed, and workspaces are
        isolated with access controls. No system is 100% secure, but we continuously work to protect your data.
      </LegalP>

      <LegalH2>10. Changes to this policy</LegalH2>
      <LegalP>We may update this policy. We will change the &quot;Last updated&quot; date above and notify you of material changes in the platform or by email.</LegalP>

      <LegalH2>11. Contact</LegalH2>
      <LegalP>
        {legalName} — {companyFullAddress()} — <LegalMail email={privacyEmail} />
      </LegalP>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      titleAr="سياسة الخصوصية"
      titleEn="Privacy Policy"
      lastUpdated={LEGAL_LAST_UPDATED}
      arabic={<ArabicPolicy />}
      english={<EnglishPolicy />}
    />
  );
}
