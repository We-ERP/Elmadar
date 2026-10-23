# 🎓 نظام إدارة المشتركين — مركز المدار

نظام تسجيل ومتابعة المشتركين والكورسات والدفعات.
- **الكود:** GitHub (المصدر الوحيد)
- **الـ Backend:** Google Apps Script (متزامن تلقائياً من GitHub)
- **قاعدة البيانات:** Google Sheets

## الهيكل
```
.clasp.json                  إعدادات clasp (Script ID)
.github/workflows/deploy.yml  النشر التلقائي عند كل Push
src/
  appsscript.json            إعدادات المشروع والـ Web app
  Code.gs                    الـ Backend
  Index.html                 الواجهة الرئيسية
  Styles.html                التنسيقات
  JavaScript.html            منطق الواجهة
assets/logo.png              اللوجو
```

## الإعداد (مرة واحدة)

### 1) إنشاء الشيت والمشروع المرتبط
1. افتح Google Sheet جديد.
2. **Extensions → Apps Script**، ومن **Project Settings** انسخ **Script ID**.
3. ضعه في `.clasp.json` مكان `PUT_YOUR_SCRIPT_ID_HERE`.

### 2) تفعيل Apps Script API
افتح `script.google.com/home/usersettings` وفعّل **Google Apps Script API**.

### 3) تسجيل الدخول بـ clasp على جهازك
```bash
npm install -g @google/clasp
clasp login
```
هيتعمل ملف `.clasprc.json` في مجلد المستخدم. (ويندوز: `C:\Users\<اسمك>\.clasprc.json`)

### 4) حفظ الصلاحيات كـ Secret في GitHub
الريبو → **Settings → Secrets and variables → Actions → New repository secret**
- الاسم: `CLASPRC_JSON`
- القيمة: محتوى ملف `.clasprc.json` كامل

### 5) رفع الكود
ارفع المشروع على فرع `main`. الـ Action هيشتغل تلقائياً ويرفع الكود للـ Apps Script.

### 6) أول نشر للـ Web app (مرة واحدة)
1. من داخل الشيت: **Extensions → Apps Script → Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
2. من **Manage deployments** انسخ **Deployment ID** (بيبدأ بـ `AKfycb...`).
3. أضفه في GitHub Secrets باسم `DEPLOYMENT_ID`.

من الآن كل Push هيحدّث نفس الرابط تلقائياً.

### 7) تشغيل الإعداد الأولي للشيتات
من محرر Apps Script شغّل **`setupSystem`** مرة واحدة، واعمل Allow للصلاحيات.
لو الشيتات فيها داتا قديمة شغّل **`migrateSheets`** بدلها.

## الدخول الأولي
- اسم المستخدم: `admin`
- كلمة المرور: `admin123`

غيّرها فوراً من صفحة المستخدمين بإضافة أدمن جديد وحذف الحساب الافتراضي.

## ملاحظات
- لا تعدّل الكود داخل Apps Script مباشرة، عدّل على GitHub دائماً عشان ما يحصلش تضارب.
- `CLASPRC_JSON` فيه صلاحيات حسابك، ما تنشرهوش أبداً.
- الرابط الخاص بالنظام هو رابط **Web app** من Apps Script (`script.google.com/macros/s/.../exec`)، ومش رابط GitHub Pages.

## 🔗 رابط النظام
```
https://script.google.com/macros/s/AKfycbxHhFkgmM8cimDrVCEYD7j-PGNNrQNQP7YkbkSCWEn5tsTdHPPuvozWwvvHV631vFmz5w/exec
```
الرابط ده بتفتحه في المتصفح عشان تدخل على النظام. ملوش علاقة بالكود، والكود ما بيستخدموش.

> ⚠️ لو الرابط ظهر فيه `No HTML file named Index`، يبقى الكود اللي على الـ deployment ده ما فيهوش ملفات الواجهة. الحل إنك ترفع الكود بالـ Workflow (Push على `main`) والـ deployment يتحدّث.
