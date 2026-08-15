# 📚 توثيق HTML Toolkit - دليل الاستخدام المفصل

## 🎯 مقدمة

**HTML Toolkit** هي مجموعة أدوات سطر أوامر (CLI) لتحليل وفحص ومعاينة ملفات HTML. 
صُمّمت لتكون بسيطة وقوية - تمنحك القدرة على فحص جودة HTML الخاص بك بصرياً.

---

## 1️⃣ 🔍 HTML Check (`check-html.js`)

### ما يفعله؟
مدقق HTML شامل يقوم بـ 3 فحوصات رئيسية:

### أ. فحص البنية الأساسية (Structural Check)
يتحقق من وجود العناصر الإلزامية في أي صفحة HTML:
| الفحص | الوصف |
|-------|--------|
| `<!DOCTYPE html>` | إعلان HTML5 |
| `<html>` | وسم البداية |
| `<head>` | رأس الصفحة |
| `<title>` | عنوان الصفحة (إلزامي لتحسين محركات البحث) |
| `<body>` | جسم الصفحة |
| `<meta charset>` | ترميز الأحرف (UTF-8) |
| `lang` attribute | لغة الصفحة |
| إغلاق الوسوم | `</html>` `</body>` `</head>` |
| توازن `<div>` | عدد الفتح = عدد الإغلاق |

### ب. فحص الموارد (Asset Check)
يتحقق من وجود كل الملفات المرتبطة بصفحة HTML:
- **الصور** (`<img src="...">`)
- **ملفات CSS** (`<link href="...">`)
- **سكربتات** (`<script src="...">`)

### ج. فحص HTMLHint (Linting)
يطبق 42 قاعدة جودة على ملف HTML، منها:
- أسماء الوسم يجب أن تكون بأحرف صغيرة
- أسماء الخصائص بأحرف صغيرة
- قيم الخصائص يجب أن تكون بين اقتباسين مزدوجين
- عدم تكرار المعرفات (id)
- وجود النص البديل للصور (alt)
- إغلاق جميع الوسوم بشكل صحيح

### أمثلة الاستخدام

```bash
# فحص ملف واحد
node scripts/check-html.js index.html

# فحص عدة ملفات
node scripts/check-html.js index.html about.html contact.html

# فحص كل ملفات HTML في مجلد
node scripts/check-html.js www/

# الحصول على تقرير JSON
node scripts/check-html.js --json index.html

# عبر npm script
npm run check -- index.html
```

### فهم النتائج

```
📐 البنية الأساسية: سليمة ✓
📎 الموارد: كلها موجودة ✓
🔍 نتائج HTMLHint:
  ❌ [سطر 5:10] The <title> tag must be present (title-require)
  ⚠️ [سطر 12:3] The value of alt attribute must be present (alt-require)

التقييم: 85% - جيد
```

---

## 2️⃣ 🌐 Preview Server (`serve.js`)

### ما يفعله؟
خادم HTTP بسيط لعرض ملفات HTML في المتصفح مع واجهة تصفح رسومية.

### الميزات
- **تصفح المجلدات** - واجهة رسومية لاستعراض ملفات HTML
- **معاينة مباشرة** - انقر على أي ملف HTML لفتحه في المتصفح
- **دعم كل أنواع الملفات** - CSS, JS, صور, خطوط
- **إعادة تحميل** - لا تخزين مؤقت (Cache-Control: no-cache)

### أمثلة الاستخدام

```bash
# تشغيل الخادم للمجلد الحالي (المنفذ 8080)
node scripts/serve.js

# تشغيل لمجلد محدد
node scripts/serve.js ../my-app

# تشغيل على منفذ مخصص
node scripts/serve.js --port 3000

# عبر npm script
npm run serve
```

### الواجهة
عند فتح الرابط في المتصفح، سترى:
- قائمة بملفات HTML مرتبة في بطاقات
- إمكانية النقر على أي ملف لفتحه
- إمكانية التنقل بين المجلدات
- معلومات عن حجم كل ملف

---

## 3️⃣ 📊 Visual Report (`visual-report.js`)

### ما يفعله؟
يُنشئ صفحة HTML بتقرير بصري احترافي عن ملف HTML. 
التقرير يحتوي على:
- **تقييم عام** بنسبة مئوية
- **تحليل البنية الأساسية** مع علامات ✓/✗
- **نتائج HTMLHint** مصنفة حسب الأخطاء والتنبيهات
- **معلومات الملف** (الاسم، الحجم، التقييم)

### أمثلة الاستخدام

```bash
# إنشاء تقرير (يُحفظ كـ report-<filename>.html)
node scripts/visual-report.js index.html

# حفظ التقرير بمسار مخصص
node scripts/visual-report.js index.html --output my-report.html

# إنشاء وفتح التقرير في المتصفح
node scripts/visual-report.js index.html --open

# عبر npm script
npm run report -- index.html
```

### فتح التقرير
التقرير هو ملف HTML عادي - افتحه في أي متصفح لرؤية النتائج بشكل بصري ملون.

---

## 4️⃣ ⚙️ الإعدادات

### إعدادات HTMLHint (`.htmlhintrc`)
يمكنك تخصيص قواعد HTMLHint عبر ملف `config/.htmlhintrc`:

```json
{
  "tagname-lowercase": true,
  "attr-lowercase": true,
  "attr-value-double-quotes": true,
  "doctype-first": true,
  "tag-pair": true,
  "title-require": true,
  "alt-require": true
}
```

يمكنك إيقاف أي قاعدة بوضع `false` بدلاً من `true`.

---

## 5️⃣ 🛠️ التثبيت

```bash
# 1. نسخ المستودع
git clone https://github.com/SagedAMV/Tool.git
cd Tool

# 2. تثبيت الاعتماديات
npm install

# 3. استخدام الأدوات (انظر الأمثلة أعلاه)
```

### الاعتماديات
| الحزمة | الإصدار | الاستخدام |
|--------|---------|-----------|
| `htmlhint` | ^1.9.2 | مدقق HTML |
| `serve` (اختياري) | ^14.2.0 | خادم معاينة (احتياطي) |

---

## 6️⃣ 🔄 سير العمل المقترح

```
1. اكتب ملف HTML → استخدم npm run serve
2. اعرض الملف في المتصفح للتأكد من شكله
3. استخدم npm run check لفحص الأخطاء
4. صلّح الأخطاء
5. استخدم npm run report للحصول على تقييم نهائي
```

---

## 7️⃣ ❓ الأسئلة الشائعة

**س: ماذا أفعل إذا ظهر خطأ "Cannot find module 'htmlhint'"؟**
ج: تأكد من تشغيل `npm install` أولاً.

**س: كيف أفحص مجلد كامل؟**
ج: استخدم `npm run check -- www/` (أي اسم مجلد).

**س: لماذا لا يفتح التقرير تلقائياً مع `--open`؟**
ج: جرب فتح الملف يدوياً من المسار الذي يظهر في التقرير.

**س: هل تدعم الأدوات نظام Windows؟**
ج: نعم، تعمل على Windows و macOS و Linux.

---

## 📞 الدعم

إذا واجهت أي مشكلة، افتح Issue في المستودع:
https://github.com/SagedAMV/Tool