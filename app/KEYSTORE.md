# 🔐 إعداد Android Keystore

## ما هو الـ Keystore؟

ملف رقمي يُستخدم لتوقيع تطبيق Android. **لا يمكن تحديث التطبيق في المتجر إلا بنفس الـ keystore**. لذلك:
- ⚠️ **احفظه في مكان آمن** (نسخة على Google Drive + نسخة محلية)
- ⚠️ **لا تنشره علناً أبداً**
- ⚠️ **لا تنساه** — لو ضاع، التطبيق بيكون "ميت" في المتجر إلى الأبد

## ✅ التوصية: Google Play App Signing

أفضل ممارسة هي ترك Google يدير المفتاح:
1. أنت تنشئ **upload keystore** (للتوقيع المؤقت)
2. ترفعه لـ Play Console أول مرة
3. Google يحتفظ بمفتاح الإصدار الحقيقي
4. حتى لو ضاع upload keystore، Google يقدر يعطيك واحد جديد

---

## 🛠️ كيف ننشئ الـ Keystore

### الطريقة 1: محلياً (يحتاج Java JDK)

```bash
# تثبيت JDK 17 على Windows
# نزّل من: https://adoptium.net/temurin/releases/?version=17

# بعد التثبيت، شغّل في PowerShell:
keytool -genkey -v -keystore upload-keystore.jks `
  -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass "اختر-كلمة-سر-قوية" `
  -keypass "اختر-كلمة-سر-قوية" `
  -dname "CN=Hussain Alhani, O=Safwa Cemetery, L=Safwa, ST=Eastern Province, C=SA"
```

### الطريقة 2: تلقائياً عبر GitHub Actions

أضفنا workflow في `.github/workflows/build-android.yml` يحتاج هذه الـ Secrets:

| Secret | القيمة |
|--------|--------|
| `ANDROID_KEYSTORE_BASE64` | محتوى الـ keystore بصيغة base64 |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور الـ keystore |
| `ANDROID_KEY_ALIAS` | `upload` (أو اسم آخر) |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |

### تحويل keystore لـ base64

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Set-Clipboard
# الآن انسخه في GitHub Secret
```

---

## 📋 معلومات Keystore المقترحة

عند التوليد، استخدم:

| الحقل | القيمة |
|--------|--------|
| Common Name (CN) | Hussain Alhani |
| Organization (O) | Safwa Cemetery |
| Organizational Unit (OU) | Mobile App |
| Locality (L) | Safwa |
| State/Province (ST) | Eastern Province |
| Country (C) | SA |
| Validity | 10000 days (~27 سنة) |
| Algorithm | RSA |
| Key size | 2048 bits |

---

## 🔍 الحصول على SHA-256 fingerprint

بعد إنشاء الـ keystore (أو من Play Console بعد رفع أول AAB):

```bash
keytool -list -v -keystore upload-keystore.jks -alias upload
```

ابحث عن سطر `SHA256:` وانسخ القيمة (مثل `AA:BB:CC:...`).

ضع هذه القيمة في `/.well-known/assetlinks.json` بدلاً من `REPLACE_WITH_PLAY_STORE_APP_SIGNING_SHA256_FINGERPRINT`.

⚠️ **مهم:** SHA-256 من **Play Console** (App signing key) — مو من upload keystore. Google يستخدم مفتاح مختلف للتوقيع النهائي.
