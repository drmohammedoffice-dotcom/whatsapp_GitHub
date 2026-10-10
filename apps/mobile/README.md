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

### تشغيل محلي

```bash
cd apps/mobile
npm install
npx expo start
```

- اضغط `a` لفتح Android Emulator / جهاز
- اضغط `i` لفتح iOS Simulator (على macOS فقط)

تغيير رابط الموقع:

```bash
# Windows PowerShell
$env:EXPO_PUBLIC_CHATLOORA_URL="https://www.chatloora.com"
npx expo start
```

### المشاريع الأصلية الجاهزة في الريبو

موجودة الآن مباشرة:

- `apps/mobile/android` — مشروع Android Studio / Gradle (Expo)
- `apps/mobile/ios` — مشروع Xcode (SwiftUI + WKWebView)

على Mac يمكن أيضاً إعادة توليد iOS عبر Expo:

```bash
cd apps/mobile
npm install
npx expo prebuild --platform ios
```

### البناء والنشر عبر EAS (موصى به)

1. ثبت EAS CLI: `npm i -g eas-cli`
2. سجّل الدخول: `eas login`
3. اربط المشروع: `eas init` (حدّث `extra.eas.projectId` في `app.config.ts`)
4. بناء تجريبي APK:

```bash
eas build -p android --profile preview
```

5. بناء إنتاج للمتاجر:

```bash
eas build -p android --profile production
eas build -p ios --profile production
```

6. رفع للمتاجر:

```bash
eas submit -p android --profile production
eas submit -p ios --profile production
```

حدّث قيم `eas.json` → `submit.production` (Apple ID / Team ID / App Store Connect App ID) وملف Service Account لـ Google Play.

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
  app/                 # شاشات Expo Router
  src/
    components/        # ChatLooraWebShell (WebView)
    config.ts          # رابط الموقع + قائمة النطاقات المسموحة
  assets/              # أيقونة / splash
  app.config.ts        # إعدادات Expo / المتاجر
  eas.json             # ملفات بناء ورفع المتاجر
```

### ملاحظات مهمة للمتاجر

1. **Privacy Policy / Terms** يجب ربطها في Play Console و App Store Connect (استخدم صفحات الموقع إن وجدت).
2. **Deep links**: مُعرّفة لـ `https://www.chatloora.com` — أضف ملف Digital Asset Links / apple-app-site-association على السيرفر عند التفعيل.
3. **OAuth** (TikTok / Meta / Google) يعمل داخل WebView للنطاقات المسموحة في `src/config.ts`.
4. لا ترفع ملفات التوقيع (`*.jks`, `*.p8`, `play-store-service-account.json`) إلى GitHub.

### مشروع Android القديم (TWA)

يوجد أيضاً مجلد قديم في جذر الريبو: `/android` (Trusted Web Activity). المشروع الأساسي للتطوير والنشر هو **`apps/mobile`**.

## English (short)

Expo app wrapping ChatLoora web. Run `npm install && npx expo start`. Use `npx expo prebuild` for native folders, then `eas build` / `eas submit` for Play Store and App Store.
