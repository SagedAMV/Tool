#!/usr/bin/env node
/**
 * visual-report.js - يُنشئ تقرير HTML بصري لملف HTML
 * يولد صفحة HTML بتقييمات وأيقونات ونتائج ملونة
 * 
 * الاستعمال:
 *   node scripts/visual-report.js index.html
 *   node scripts/visual-report.js index.html --output report.html
 *   node scripts/visual-report.js --open     (يفتح التقرير في المتصفح)
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { HTMLHint } from 'htmlhint';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const fileArg = args.find(a => !a.startsWith('--'));
const outputFlag = args[args.indexOf('--output') + 1];
const shouldOpen = args.includes('--open');

if (!fileArg) {
  console.log('الاستعمال: node scripts/visual-report.js <file.html> [--output report.html] [--open]');
  process.exit(1);
}

const filePath = resolve(fileArg);
if (!existsSync(filePath)) {
  console.log(`❌ الملف غير موجود: ${filePath}`);
  process.exit(1);
}

const content = readFileSync(filePath, 'utf-8');
const fileName = filePath.split('/').pop();

// HTMLHint
const hints = HTMLHint.verify(content, {
  'tagname-lowercase': true, 'attr-lowercase': true, 'attr-value-double-quotes': true,
  'doctype-first': true, 'tag-pair': true, 'id-unique': true, 'title-require': true, 'alt-require': true
});

// إحصائيات
const errors = hints.filter(h => h.type === 'error').length;
const warnings = hints.filter(h => h.type !== 'error').length;
const dt = /<\!DOCTYPE\s+html>/i.test(content);
const hasTitle = /<title>/i.test(content);
const hasMeta = /<meta[^>]+charset=/i.test(content);
const hasLang = /<html[^>]+lang=/i.test(content);
const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(content);
const divBalance = (content.match(/<div[\s>]/g)||[]).length === (content.match(/<\/div>/g)||[]).length;
const score = hints.length === 0 ? 100 : Math.max(0, Math.round((1 - errors / hints.length) * 100));

const grade = score >= 90 ? 'ممتاز' : score >= 70 ? 'جيد' : 'يحتاج تحسين';
const gradeColor = score >= 90 ? '#00b894' : score >= 70 ? '#fdcb6e' : '#ff7675';

const outputPath = outputFlag ? resolve(outputFlag) : resolve('report-' + fileName.replace('.html', '.html'));
const relPath = relative(process.cwd(), filePath);

const html = `<!DOCTYPE html>
<html dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📊 تقرير: ${fileName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  body{background:#f0f2f8;color:#1a1a2e;padding:20px;max-width:800px;margin:0 auto}
  .header{background:linear-gradient(135deg,${gradeColor},${gradeColor}cc);color:white;border-radius:20px;padding:24px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
  .header .icon{font-size:48px}
  .header h1{font-size:18px;font-weight:800}
  .header p{font-size:13px;opacity:0.9;margin-top:4px}
  .score{font-size:48px;font-weight:900;margin-right:auto}
  .card{background:white;border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
  .card h2{font-size:14px;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#2d3436}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .item{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8f9fe;border-radius:10px;font-size:12px;font-weight:600}
  .item.pass{background:#e8fff3;color:#00b894}
  .item.fail{background:#ffecf0;color:#ff7675}
  .item .icon{font-size:16px}
  .hint{margin:8px 0;padding:10px 12px;border-radius:10px;font-size:12px;background:#f8f9fe;display:flex;align-items:start;gap:8px;line-height:1.5}
  .hint.error{background:#ffecf0;border-right:3px solid #ff7675}
  .hint.warning{background:#fff8e1;border-right:3px solid #fdcb6e}
  .hint .type{font-weight:800;font-size:10px;padding:2px 6px;border-radius:4px;background:#eee;margin-left:4px;flex-shrink:0}
  .hint .msg{flex:1}
  .hint .rule{font-size:10px;color:#a0a4b8}
  .pct{width:100%;height:6px;background:#f0f1f5;border-radius:10px;margin:8px 0;overflow:hidden}
  .pct-bar{height:100%;background:${gradeColor};border-radius:10px;width:${score}%;transition:width 1s}
  .footer{text-align:center;font-size:11px;color:#a0a4b8;margin-top:24px;padding:16px}
</style></head><body>
  <div class="header">
    <div class="icon">📊</div>
    <div><h1>${fileName}</h1><p>${relPath} • ${content.length.toLocaleString()} حرف • ${hints.length} نتيجة</p></div>
    <div class="score">${score}%</div>
  </div>
  <div class="pct"><div class="pct-bar"></div></div>
  
  <div class="card">
    <h2>📐 البنية الأساسية</h2>
    <div class="grid">
      <div class="item ${dt ? 'pass' : 'fail'}"><span class="icon">${dt ? '✓' : '✗'}</span> DOCTYPE html5</div>
      <div class="item ${hasTitle ? 'pass' : 'fail'}"><span class="icon">${hasTitle ? '✓' : '✗'}</span> وسم &lt;title&gt;</div>
      <div class="item ${hasMeta ? 'pass' : 'fail'}"><span class="icon">${hasMeta ? '✓' : '✗'}</span> meta charset</div>
      <div class="item ${hasLang ? 'pass' : 'fail'}"><span class="icon">${hasLang ? '✓' : '✗'}</span> سمة lang</div>
      <div class="item ${hasViewport ? 'pass' : 'fail'}"><span class="icon">${hasViewport ? '✓' : '✗'}</span> meta viewport</div>
      <div class="item ${divBalance ? 'pass' : 'fail'}"><span class="icon">${divBalance ? '✓' : '✗'}</span> توازن &lt;div&gt;</div>
    </div>
  </div>
  
  <div class="card">
    <h2>🔍 نتائج HTMLHint (${hints.length})</h2>
    ${hints.length === 0 ? `<p style="color:#00b894;font-weight:700;font-size:13px">✅ لا توجد مشاكل! الملف نظيف ✓</p>` : ''}
    ${hints.map(h => `<div class="hint ${h.type === 'error' ? 'error' : 'warning'}">
      <span class="type">${h.type === 'error' ? 'خطأ' : 'تنبيه'}</span>
      <span class="msg">${h.message} <span class="rule">(سطر ${h.line})</span></span>
      <span class="rule">${h.rule.id}</span>
    </div>`).join('')}
  </div>
  
  <div class="card">
    <h2>ℹ️ معلومات الملف</h2>
    <div class="grid">
      <div class="item"><span class="icon">📄</span> الاسم: ${fileName}</div>
      <div class="item"><span class="icon">📏</span> الحجم: ${(content.length/1024).toFixed(0)} KB</div>
      <div class="item"><span class="icon">📊</span> التقييم: ${grade}</div>
      <div class="item"><span class="icon">⚠️</span> أخطاء: ${errors} / تنبيهات: ${warnings}</div>
    </div>
  </div>
  
  <div class="footer">تم التوليد بواسطة HTML Toolkit 🛠️</div>
</body></html>`;

writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ تم إنشاء التقرير: ${outputPath}`);
console.log(`📊 التقييم: ${score}% - ${grade}`);

if (shouldOpen) {
  try {
    execSync(`open "${outputPath}"`); // macOS
    execSync(`xdg-open "${outputPath}"`); // Linux
  } catch {}
}