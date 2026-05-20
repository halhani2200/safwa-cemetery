# ✅ Checklist إطلاق التطبيق على Google Play

استخدم هذا الملف كقائمة تحقّق مرتبة من الألف للياء.

---

## 🟢 المرحلة 0: التحضيرات (مكتملة ✅)

- [x] الموقع منشور على Cloudflare Pages
- [x] الدومين `safwa-cemetery.com` مربوط
- [x] PWA كاملة (manifest + service worker + offline)
- [x] صفحات قبر فردية SEO (`/grave/[id]`)
- [x] sitemap ديناميكي (190 رابط)
- [x] schema.org markup
- [x] صفحة سياسة الخصوصية `/privacy`
- [x] أيقونات PNG (192, 512, maskable, store-512)
- [x] assetlinks.json (placeholder للـ SHA-256)
- [x] Capacitor scaffolding في `/app/`
- [x] GitHub Actions workflows (Android + iOS)
- [x] جميع نصوص المتجر جاهزة (`STORE_LISTING.md`)

---

## 🟡 المرحلة 1: حسابات وتفعيل (عندك)

### Google Play Console
- [x] حساب أُنشئ (Hussain Alhani, ID: 5311528683307130248)
- [x] دفعة $25 للتسجيل
- [x] إثبات Android device
- [x] رقم الهاتف
- [ ] ⏳ **إثبات الهوية** (Google يراجع، بضعة أيام)

### Apple Developer (لاحقاً)
- [ ] تسجيل في $99/سنة
- [ ] تفعيل Apple Developer Program (3-5 أيام)

### GitHub
- [ ] حساب GitHub (راجع `GITHUB_SETUP.md`)
- [ ] إنشاء repo `safwa-cemetery`
- [ ] رفع الكود
- [ ] إضافة Secrets

### Keystore (لتوقيع APK)
- [ ] تثبيت Java JDK 17 على Windows
- [ ] توليد upload-keystore.jks (راجع `KEYSTORE.md`)
- [ ] حفظ نسخة احتياطية (Google Drive + USB)
- [ ] إضافة لـ GitHub Secrets

---

## 🟠 المرحلة 2: بناء التطبيق

- [ ] تشغيل GitHub Action `build-android.yml`
- [ ] تنزيل debug APK وتجربته على BlueStacks/جوال أندرويد
- [ ] اختبار جميع الميزات داخل التطبيق:
  - [ ] البحث بالاسم
  - [ ] فتح صفحة قبر
  - [ ] زر "توجّه إلى القبر" (يفتح Google Maps)
  - [ ] إشعارات Push (لازم تأكيد منك)
  - [ ] أداء عام (سرعة، استجابة)

---

## 🔴 المرحلة 3: رفع لـ Google Play (بعد اعتماد الهوية)

### إنشاء التطبيق في Play Console
- [ ] **زر "إنشاء تطبيق"** (سيُفتح بعد اعتماد الهوية)
- [ ] الاسم: "مقبرة صفوى"
- [ ] اللغة الافتراضية: العربية (السعودية)
- [ ] التطبيق: مجاني / غير ربحي

### Store Listing (راجع `STORE_LISTING.md`)
- [ ] الوصف القصير (عربي + إنجليزي)
- [ ] الوصف الكامل (عربي + إنجليزي)
- [ ] رفع أيقونة المتجر `icon-store-512.png`
- [ ] رفع لقطات الشاشة (6-8 صور)
- [ ] رابط سياسة الخصوصية: `https://safwa-cemetery.com/privacy`
- [ ] التصنيف: Lifestyle / Reference
- [ ] تصنيف العمر (راجع الأسئلة في STORE_LISTING.md)

### App Content Section
- [ ] إعلان الإعلانات: لا إعلانات
- [ ] الوصول المُستهدف للأطفال: لا
- [ ] الأمان والصلاحيات: كاميرا + GPS (للموظفين) + إشعارات
- [ ] قبول سياسات المطوّر

### رفع AAB
- [ ] إنشاء Release في "Testing → Internal testing" أولاً
- [ ] رفع `app-release.aab` من GitHub artifacts
- [ ] اختبار داخلي مع emails محددة
- [ ] بعد التأكد: Release to Production

### بعد الموافقة (Google يراجع 1-7 أيام)
- [ ] الحصول على SHA-256 من Play Console → App Integrity
- [ ] تحديث `/.well-known/assetlinks.json` بـ SHA-256 الصحيح
- [ ] إعادة نشر الموقع
- [ ] اختبار Android App Links

---

## 🟣 المرحلة 4: التسويق

- [ ] إعلان في قناة "القطيف اليوم" (تلجرام)
- [ ] إعلان في مجموعات واتساب لأهل صفوى
- [ ] نشر في منصات التواصل
- [ ] تحديث `Hussain Alhani` في Play Console بمعلومات الجمعية (لو انتقلنا لحساب رسمي)

---

## 📚 الملفات المرجعية

| الملف | الغرض |
|-------|-------|
| `STORE_LISTING.md` | كل نصوص المتجر جاهزة |
| `KEYSTORE.md` | كيف ننشئ keystore وننسخه لـ GitHub |
| `GITHUB_SETUP.md` | كيف نسوي GitHub repo و workflows |
| `README.md` | معلومات عامة عن الـ Capacitor project |
| `capacitor.config.json` | إعدادات التطبيق (Bundle ID، خادم، plugins) |
| `.github/workflows/build-android.yml` | بناء Android تلقائياً |
| `.github/workflows/build-ios.yml` | بناء iOS تلقائياً |

---

## 🚀 الخطوة الفورية التالية لك

1. **انتظر اعتماد الهوية من Google** (يصلك إيميل)
2. **بالتوازي:** ابدأ بـ GitHub:
   - أنشئ حساب لو ما عندك (https://github.com/signup)
   - أنشئ repo (https://github.com/new)
   - ارفع الكود (راجع `GITHUB_SETUP.md`)
3. **ثبّت Java JDK** على Windows: https://adoptium.net/temurin/releases/
4. **أعطني خبر** لما تخلص نقطة 2، وأنا أرشدك في توليد الـ keystore.

---

## 📞 إذا احتجت مساعدة

أنا متاح طوال الوقت. أبلغني بأي خطوة تواجه فيها صعوبة، وسأرشدك خطوة بخطوة عبر المتصفح.
