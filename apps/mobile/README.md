# ChatLoora Mobile (Android + iOS)

تطبيق ChatLoora الرسمي للجوال — مشروع **Expo / React Native** يفتح منصة [chatloora.com](https://www.chatloora.com) داخل WebView أصلي جاهز للنشر على:

- Google Play (Android)
- Apple App Store (iOS)

المسار داخل المونوريبو: `apps/mobile`

## للمطور

### المتطلبات

- Node.js 20+
- npm أو pnpm
- لحسابات المتاجر:
  - Android: حساب Google Play Console
  - iOS: حساب Apple Developer + Mac مع Xcode لبناء iOS محلياً
- اختياري: حساب [Expo EAS](https://expo.dev) لبناء السحابة بدون إعداد Android SDK/Xcode محلياً

### تشغيل محلي (Expo Go)

المشروع على **Expo SDK 58**، فيعمل مع آخر نسخة من تطبيق Expo Go على الجوال.

```bash
cd apps/mobile
npm install
npx expo start
```

- امسح رمز QR بتطبيق Expo Go (أندرويد) أو بالكاميرا (iPhone).
- إذا كان الجوال على شبكة مختلفة: `npm run start:tunnel`
- اضغط `a` لفتح Android Emulator، و `i` لفتح iOS Simulator (على macOS فقط)

تغيير رابط الموقع:

```bash
# Windows PowerShell
$env:EXPO_PUBLIC_CHATLOORA_URL="https://www.chatloora.com"
npx expo start
```

### المجلدات الأصلية (android / ios)

لا تُرفع إلى الريبو. EAS يولّدها من `app.config.ts` عند كل بناء (Continuous Native Generation).
لتوليدها محلياً عند الحاجة:

```bash
npm run prebuild
```

### البناء والنشر عبر EAS (موصى به)

المشروع مربوط بـ EAS: `@hexdefender1/chatloora` (projectId في `app.config.ts`).
ملف `.easignore` في جذر الريبو يجعل EAS يرفع `apps/mobile` فقط.

1. نسخة تجريبية APK للأندرويد (تُثبّت مباشرة على الجوال):

```bash
npm run build:android:preview
```

2. نسخة iOS تجريبية (تحتاج حساب Apple Developer، و EAS يسألك عن تسجيل الدخول والأجهزة):

```bash
npm run build:ios:preview
```

3. بناء إنتاج للمتاجر ثم الرفع:

```bash
npm run build:production
eas submit -p android --profile production
eas submit -p ios --profile production
```

أول `eas submit` يسألك عن ملف Service Account لـ Google Play وبيانات App Store Connect.

### المعرفات الحالية

| المنصة | المعرف |
|--------|--------|
| Android package | `com.chatloora.app` |
| iOS bundle id | `com.chatloora.app` |
| اسم التطبيق | ChatLoora / جات لورا |
| الإصدار | `1.0.0` |

### هيكل الكود

```
apps/mobile/
  src/
    components/        # ChatLooraWebShell (WebView + شاشة الخطأ/عدم الاتصال)
    native/            # جسر الويب: bridge.ts / downloads.ts / push.ts
    config.ts          # رابط الموقع + النطاقات المسموحة/المحظورة
    theme.ts           # ألوان الهوية (فاتح/داكن)
  locales/ar.json      # اسم التطبيق ونصوص الأذونات بالعربية
  assets/              # أيقونة / splash / notification-icon
  app.config.ts        # إعدادات Expo / المتاجر (privacy manifest، الأذونات، الإشعارات)
  eas.json             # ملفات بناء ورفع المتاجر
```

### جسر الويب ↔ التطبيق

- من الويب: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))` (يُقبل فقط من صفحات chatloora.com).
- إلى الويب: حدث `chatloora:native` على `window` وفيه `detail` = الرسالة.
- `{type:'download', id, fileName, mimeType, base64}` ← يحفظ الملف مؤقتاً ويفتح نافذة المشاركة، والرد `{type:'download:result', id, ok:true}` أو `ok:false` مع `error`
  (`invalid_message` / `too_large` (أكثر من 50MB) / `busy` / `sharing_unavailable` / `write_failed` / `share_failed`).
- `{type:'push:register'}` ← `{type:'push:token', token, platform}` أو `{type:'push:denied', reason:'permission'|'unavailable'}`.
- عند الضغط على إشعار: إذا كان `data.url` مساراً نسبياً (مثل `/inbox/42`) يُفتح داخل التطبيق.

### متطلبات الإشعارات (Push)

- **Android (FCM):** أنشئ مشروع Firebase لـ `com.chatloora.app` ونزّل `google-services.json` (لا يُرفع للريبو)، ثم:
  `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production --environment preview --environment development`
  وارفع مفتاح FCM V1 (Service Account) عبر `eas credentials` → Android → Push Notifications.
- **iOS (APNs):** `eas credentials` → iOS → Push Notifications ينشئ/يرفع مفتاح APNs (.p8).
- الخادم يرسل عبر Expo Push API مع `channelId: 'messages'` و `data: { url: '/inbox/...' }`.

### ملاحظات مهمة للمتاجر

1. **Privacy Policy / Terms** يجب ربطها في Play Console و App Store Connect (استخدم صفحات الموقع إن وجدت).
2. **Deep links**: مُعرّفة لـ `https://www.chatloora.com` — أضف ملف Digital Asset Links / apple-app-site-association على السيرفر عند التفعيل.
3. **OAuth**: TikTok و Meta يعملان داخل WebView. صفحات Google (accounts.google.com) تُفتح في متصفح النظام لأن Google تمنع الـ WebView. ربط واتساب عبر Embedded Signup يعتمد على `window.opener` ويحتاج اختبار.
5. **الإشعارات (Push)** مفعّلة في التطبيق (انظر "متطلبات الإشعارات" أعلاه)؛ حفظ الرموز والإرسال مسؤولية الخادم.
6. **expo-dev-client** يضيف `NSBonjourServices` / `NSLocalNetworkUsageDescription` لبناء التطوير فقط؛ SDK 58 يحذفها تلقائياً من بناء Release وكوده الأصلي لا يدخل نسخ الإنتاج.
4. لا ترفع ملفات التوقيع (`*.jks`, `*.p8`, `play-store-service-account.json`) إلى GitHub.

### مشروع Android القديم (TWA)

يوجد أيضاً مجلد قديم في جذر الريبو: `/android` (Trusted Web Activity). المشروع الأساسي للتطوير والنشر هو **`apps/mobile`**.

## English (short)

Expo app wrapping ChatLoora web. Run `npm install && npx expo start`. Native folders are generated by EAS (CNG); use `eas build` / `eas submit` for Play Store and App Store.
