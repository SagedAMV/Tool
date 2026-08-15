# 🛠️ HTML Toolkit

> مجموعة أدوات لفحص وتحليل ومعاينة ملفات HTML بصرياً

## 📦 الأدوات

| الأداة | الأمر | الوصف |
|--------|-------|-------|
| **🔍 HTML Check** | `npm run check` | فحص شامل لملفات HTML (بنيان، موارد، linting) |
| **🌐 Preview Server** | `npm run serve` | خادم معاينة بصري مع متصفح ملفات |
| **📊 Visual Report** | `npm run report` | يُنشئ تقرير HTML بصري ملون بتقييمات |

## 🚀 البدء السريع

```bash
# 1. تثبيت الأدوات
npm install

# 2. فحص ملف HTML
npm run check -- index.html

# 3. معاينة الملفات في المتصفح
npm run serve

# 4. إنشاء تقرير بصري
npm run report -- index.html
```

## 🔍 HTML Check

فحص كامل للملف يشمل:

- **البنية الأساسية**: DOCTYPE، `<title>`، `<meta>`، وسوم إلزامية
- **الموارد**: التحقق من وجود الصور والروابط والسكربتات المحلية
- **HTMLHint**: 42 قاعدة لتحليل جودة HTML

```bash
# فحص ملف واحد
npm run check -- index.html

# فحص مجلد كامل
npm run check -- www/

# فحص عدة ملفات
npm run check -- index.html about.html

# تقرير بصيغة JSON
npm run check -- --json index.html
```

## 🌐 Preview Server

خادم HTTP بسيط لعرض ملفات HTML في المتصفح مع واجهة تصفح:

```bash
# تشغيل الخادم (المجلد الحالي)
npm run serve

# تشغيل على منفذ مختلف
npm run serve -- --port 3000

# تشغيل لمجلد محدد
npm run serve -- ../my-app
```

## 📊 Visual Report

يُنشئ صفحة HTML بتقرير بصري احترافي للتقييم:

```bash
# تقرير افتراضي
npm run report -- index.html

# حفظ التقرير بمسار محدد
npm run report -- index.html --output my-report.html

# فتح التقرير تلقائياً في المتصفح
npm run report -- index.html --open
```

## 📁 هيكل المشروع

```
Tool/
├── package.json              # الإعدادات والاعتماديات
├── README.md                 # هذا الملف
├── DOCS.md                   # توثيق مفصل
├── config/
│   └── .htmlhintrc           # إعدادات HTMLHint
└── scripts/
    ├── check-html.js         # مدقق HTML شامل
    ├── serve.js              # خادم المعاينة
    └── visual-report.js      # مولد التقارير البصرية
```

## 📋 المتطلبات

- **Node.js** 20 أو أحدث
- **npm** 8 أو أحدث

## 📄 الترخيص

MIT