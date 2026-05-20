# تطبيق مقبرة صفوى - Safwa Cemetery App

تطبيق جوال (Android + iOS) لموقع [safwa-cemetery.com](https://safwa-cemetery.com) مبني بـ Capacitor.

## البنية

- **www/** — محتوى ويب مؤقت (المحتوى الحقيقي من `server.url` في `capacitor.config.json`)
- **android/** — مشروع Android (يُولَّد بعد `npx cap add android`)
- **ios/** — مشروع iOS (يُولَّد بعد `npx cap add ios`)
- **capacitor.config.json** — إعدادات Capacitor الرئيسية

## التشغيل المحلي

```bash
# تثبيت المكتبات
npm install

# إضافة منصة Android
npx cap add android

# إضافة منصة iOS (يحتاج Mac)
npx cap add ios

# مزامنة الإعدادات
npx cap sync

# فتح Android Studio (Windows/Mac/Linux)
npx cap open android

# فتح Xcode (Mac فقط)
npx cap open ios
```

## البناء عبر GitHub Actions

التطبيق يُبنى تلقائياً عند الـ push على branch `main`:
- **Android:** `.github/workflows/build-android.yml` — ينتج AAB جاهز لـ Google Play
- **iOS:** `.github/workflows/build-ios.yml` — ينتج IPA جاهز لـ App Store

## النشر

### Android (Google Play)
1. ادخل [Google Play Console](https://play.google.com/console/)
2. أنشئ تطبيق جديد
3. ارفع `app-release.aab` من GitHub Actions artifacts

### iOS (App Store)
1. ادخل [App Store Connect](https://appstoreconnect.apple.com/)
2. أنشئ تطبيق جديد بـ Bundle ID = `com.safwacemetery.app`
3. ارفع IPA عبر Transporter app

## الأذونات النيتف المستخدمة

- 📷 **الكاميرا** — تصوير شواهد القبور (للموظفين/المتطوعين)
- 📍 **GPS** — تحديد إحداثيات القبور (للموظفين/المتطوعين)
- 🔔 **Push Notifications** — إعلانات الوفاة
- 📤 **Share** — مشاركة الموقع/القبر

## الأيقونات والشاشات

ضع الأيقونة الأصلية في `resources/icon.png` (1024×1024) و `resources/splash.png` (2732×2732)، ثم نفّذ:

```bash
npx @capacitor/assets generate --iconBackgroundColor "#0E4D3F" --splashBackgroundColor "#0E4D3F"
```
