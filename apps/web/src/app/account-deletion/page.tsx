import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountDeletionActions } from '@/components/legal/account-deletion-actions';
import { LegalH2, LegalLayout, LegalList, LegalMail, LegalP } from '@/components/legal/legal-layout';
import { COMPANY_LEGAL, LEGAL_LAST_UPDATED, LEGAL_ROUTES } from '@/lib/company-info';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'حذف حساب ChatLoora — Delete your ChatLoora account',
  description:
    'How to delete your ChatLoora account and associated data, what is deleted, what is retained and for how long.',
  alternates: { canonical: `${baseUrl}${LEGAL_ROUTES.accountDeletion}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Delete your ChatLoora account',
    description: 'Steps to delete your ChatLoora account and what happens to your data.',
    url: `${baseUrl}${LEGAL_ROUTES.accountDeletion}`,
    type: 'article',
  },
};

const { privacyEmail, tradeName, legalName } = COMPANY_LEGAL;

function ArabicContent() {
  return (
    <>
      <LegalP>
        تشرح هذه الصفحة كيفية حذف حسابك في <strong>{tradeName}</strong> (تشغيل {legalName}) والبيانات المرتبطة به.
      </LegalP>

      <LegalH2>كيف أحذف حسابي؟</LegalH2>
      <LegalList>
        <li>من التطبيق أو الموقع: سجّل الدخول ثم اذهب إلى <strong>الإعدادات ← الحساب ← حذف الحساب</strong>.</li>
        <li>أدخل كلمة المرور الحالية واكتب كلمة التأكيد <strong dir="ltr">DELETE</strong> ثم اضغط «حذف الحساب نهائياً».</li>
        <li>
          إذا لم تتمكن من تسجيل الدخول، راسلنا على <LegalMail email={privacyEmail} /> من البريد الإلكتروني المسجّل في حسابك وسنتحقق
          من هويتك وننفّذ الحذف.
        </li>
      </LegalList>

      <LegalH2>ما الذي يُحذف؟</LegalH2>
      <LegalList>
        <li>ملف الحساب الشخصي (الاسم، البريد، الهاتف، كلمة المرور).</li>
        <li>جلسات واتساب وبيانات الاعتماد الخاصة بالأرقام المرتبطة.</li>
        <li>محادثات صندوق الوارد وجهات الاتصال والوسائط.</li>
        <li>بيانات التتبع (النقرات وأرقام المرسلين وبيانات التحويل).</li>
        <li>ربط حسابات تيك توك ورموز الوصول (tokens).</li>
        <li>بيانات النماذج الفورية والمتجر الإلكتروني والطلبات.</li>
        <li>الملفات التي رفعتها.</li>
      </LegalList>

      <LegalH2>ما الذي نحتفظ به؟</LegalH2>
      <LegalList>
        <li>سجلات الدفع والفواتير، للمدة التي تفرضها الالتزامات المحاسبية والقانونية.</li>
        <li>الحد الأدنى من سجلات التدقيق الأمني (حتى 12 شهراً) لحماية المنصة ومنع الاحتيال.</li>
      </LegalList>

      <LegalH2>المدة الزمنية</LegalH2>
      <LegalP>
        يتم الحذف فوراً عند تأكيد الطلب، وتُزال البيانات من النسخ الاحتياطية خلال 30 يوماً. لا يمكن التراجع عن الحذف. لمزيد من
        التفاصيل راجع <Link href={LEGAL_ROUTES.privacy} className="text-violet-700 hover:underline">سياسة الخصوصية</Link>.
      </LegalP>
    </>
  );
}

function EnglishContent() {
  return (
    <>
      <LegalP>
        This page explains how to delete your <strong>{tradeName}</strong> account (operated by {legalName}) and the associated data.
      </LegalP>

      <LegalH2>How do I delete my account?</LegalH2>
      <LegalList>
        <li>In the app or on the website: sign in and go to <strong>Settings → Account → Delete account</strong>.</li>
        <li>Enter your current password, type <strong>DELETE</strong> to confirm, then tap &quot;Delete account permanently&quot;.</li>
        <li>
          If you cannot sign in, email <LegalMail email={privacyEmail} /> from your account email; we will verify your identity and
          delete the account.
        </li>
      </LegalList>

      <LegalH2>What is deleted</LegalH2>
      <LegalList>
        <li>Your account profile (name, email, phone, password).</li>
        <li>WhatsApp sessions and credentials of linked numbers.</li>
        <li>Inbox conversations, contacts and media.</li>
        <li>Tracking data (clicks, sender numbers and conversion data).</li>
        <li>TikTok connections and access tokens.</li>
        <li>Instant forms, online store and order data.</li>
        <li>Files you uploaded.</li>
      </LegalList>

      <LegalH2>What is retained</LegalH2>
      <LegalList>
        <li>Payment records and invoices, for as long as accounting and legal obligations require.</li>
        <li>Minimal security audit logs (up to 12 months) to protect the platform and prevent fraud.</li>
      </LegalList>

      <LegalH2>Timeline</LegalH2>
      <LegalP>
        Deletion is immediate once confirmed; data is removed from backups within 30 days. Deletion cannot be undone. See our{' '}
        <Link href={LEGAL_ROUTES.privacy} className="text-violet-700 hover:underline">Privacy Policy</Link> for more details.
      </LegalP>
    </>
  );
}

export default function AccountDeletionPage() {
  return (
    <LegalLayout
      titleAr="حذف حسابك في ChatLoora"
      titleEn="Delete your ChatLoora account"
      lastUpdated={LEGAL_LAST_UPDATED}
      top={<AccountDeletionActions />}
      arabic={<ArabicContent />}
      english={<EnglishContent />}
    />
  );
}
