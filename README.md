# 🎓 نظام إدارة المشتركين — مركز المدار

- **الواجهة (HTML/CSS/JS):** GitHub Pages — الملفات في الجذر.
- **الـ API:** Google Apps Script — مكان الكود في `apps-script/Code.gs`.
- **قاعدة البيانات:** Google Sheets.

## الهيكل
```
index.html          الواجهة الرئيسية
styles.css          التنسيقات
app.js              منطق الواجهة (بيكلم الـ API)
config.js           رابط الـ API
assets/logo.png     اللوجو
apps-script/Code.gs الـ API (بيتنسخ في Apps Script)
```

## 1) الـ API (Apps Script) — مرة واحدة ولأي تعديل في الكود
1. افتح الشيت → **Extensions → Apps Script**.
2. امسح محتوى `Code.gs` وانسخ محتوى `apps-script/Code.gs` والصقه، واحفظ.
3. شغّل **`setupSystem`** مرة واحدة (أول مرة بس) واعمل Allow للصلاحيات.
4. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
   (الرابط بيفضل نفسه، فمش محتاج تغيّر `config.js`.)

لو الشيتات فيها داتا قديمة، شغّل **`migrateSheets`** بدل `setupSystem`.

## 2) الواجهة (GitHub Pages)
1. ارفع الملفات على GitHub (فرع `main`).
2. **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save.**
3. بعد دقيقة هتلاقي الرابط: `https://<username>.github.io/<repo>/`

التعديلات على الواجهة (HTML/CSS/JS) بتظهر أوتوماتيك بعد أي Push.

## 3) الدخول الأولي
- اسم المستخدم: `admin`
- كلمة المرور: `admin123` — غيّرها فوراً من صفحة المستخدمين.

## اختبار الـ API
افتح رابط الـ API في المتصفح، لازم تشوف:
`{"ok":true,"message":"API مركز المدار شغال ✅"}`

## ملاحظات
- الـ Apps Script مش بيتحدّث من GitHub تلقائياً، لازم تنسخ `Code.gs` يدوي زي الخطوة 1 بعد كل تعديل على الـ API.
- الواجهة لو اتعدّلت بتتحدّث من GitHub أوتوماتيك.
- الكود مش فيه أي صلاحيات أو أسرار، بس متشاركش رابط الشيت مع حد من خارج الفريق.
