# 🐙 إعداد GitHub لبناء التطبيق

## لماذا GitHub؟

- لبناء APK/AAB تلقائياً (لا يحتاج Android Studio على جهازك)
- لبناء iOS IPA على macOS runner مجاناً (أنت على Windows)
- نسخة احتياطية للكود

## الخطوات

### 1. أنشئ حساب GitHub (إن لم يكن لديك)

- اذهب لـ: https://github.com/signup
- استخدم نفس Gmail (`yeshussainalhani@gmail.com`) للتوحيد

### 2. أنشئ Repository

- بعد تسجيل الدخول: https://github.com/new
- **اسم الـ repo:** `safwa-cemetery`
- **الوصف:** "موقع وتطبيق مقبرة صفوى - خدمة مجتمعية"
- **Visibility:** Private (محبّذ لو فيه أسرار) أو Public (مجاني للـ Actions)
- **اضغط:** Create repository

### 3. ارفع الكود

افتح PowerShell في مجلد المشروع:

```powershell
cd C:\Users\Hussain\Downloads\safwa-cemetery-site

# تهيئة Git
git init -b main
git add .
git commit -m "Initial commit: Safwa Cemetery website + Capacitor app scaffolding"

# اربط بـ GitHub (استبدل USERNAME)
git remote add origin https://github.com/USERNAME/safwa-cemetery.git
git push -u origin main
```

⚠️ **قبل الرفع:** تأكد أن الملفات الحساسة مستثناة. أنشئ ملف `.gitignore` في الجذر:

```
node_modules/
*.keystore
*.jks
keystore.properties
.wrangler/
.dev.vars
.env
```

### 4. أضف Secrets للـ Actions

في صفحة الـ repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | متى نضيفه؟ | كيف نحصل عليه؟ |
|--------|-------------|----------------|
| `ANDROID_KEYSTORE_BASE64` | بعد إنشاء keystore | راجع `KEYSTORE.md` |
| `ANDROID_KEYSTORE_PASSWORD` | بعد إنشاء keystore | اللي اخترته أثناء التوليد |
| `ANDROID_KEY_ALIAS` | بعد إنشاء keystore | عادةً `upload` |
| `ANDROID_KEY_PASSWORD` | بعد إنشاء keystore | اللي اخترته |
| `CLOUDFLARE_API_TOKEN` | (اختياري) للنشر التلقائي | https://dash.cloudflare.com/profile/api-tokens |

### 5. شغّل أول build

في الـ repo → **Actions → Build Android APK & AAB → Run workflow**

أو ادفع commit جديد:

```powershell
git commit --allow-empty -m "Trigger build"
git push
```

سيستغرق الـ build حوالي 5-10 دقائق. النتيجة:
- **APK** للتجريب → نزّله وثبّته على جوال أندرويد لاختبار
- **AAB** للرفع لـ Play Store (يتطلب وجود الـ keystore secrets)

### 6. نزّل المخرجات

بعد اكتمال الـ build، اضغط على الـ workflow run → في الأسفل قسم **Artifacts** → نزّل:
- `safwa-cemetery-debug-apk` (للتجريب)
- `safwa-cemetery-release-aab` (للرفع للمتجر)

## ⚙️ Workflows متاحة

| Workflow | متى يشتغل؟ | المخرجات |
|----------|--------------|----------|
| `build-android.yml` | عند تعديل `app/**` | APK + AAB |
| `build-ios.yml` | عند تعديل `app/**` | iOS Archive |

## 🆘 إذا فشل الـ build

افتح الـ run → اضغط على الـ step الفاشل → اقرأ الـ logs. الأخطاء الشائعة:
- `package-lock.json` مفقود → سيُولَّد تلقائياً في أول npm install
- Keystore secret خطأ → تأكد من base64 الصحيح
- Capacitor لم يضِف Android → workflow يفعلها تلقائياً لو غير موجودة
