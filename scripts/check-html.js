#!/usr/bin/env node
/**
 * check-html.js - مدقق HTML شامل
 * يحلل ملف HTML ويعطي تقريراً بصرياً ملوناً في الطرفية
 * 
 * الاستعمال:
 *   node scripts/check-html.js index.html
 *   node scripts/check-html.js www/**\/*.html
 *   node scripts/check-html.js --json index.html   (تقرير JSON)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { HTMLHint } from 'htmlhint';

// ===== ألوان الطرفية =====
const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.log(`${C.yellow}الاستعمال:${C.reset}`);
  console.log(`  node scripts/check-html.js <file.html> [files...]`);
  console.log(`  node scripts/check-html.js --json <file.html>`);
  console.log(`  node scripts/check-html.js <folder>`);
  process.exit(1);
}

// ===== جمع الملفات (يدعم مجلدات) =====
function collectFiles(paths) {
  const result = [];
  for (const p of paths) {
    if (!existsSync(p)) {
      console.log(`${C.red}❌ الملف غير موجود: ${p}${C.reset}`);
      continue;
    }
    const st = statSync(p);
    if (st.isDirectory()) {
      walkDir(p, result);
    } else if (p.endsWith('.html') || p.endsWith('.htm')) {
      result.push(p);
    }
  }
  return result;
}

function walkDir(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkDir(full, out);
    else if (full.endsWith('.html') || full.endsWith('.htm')) out.push(full);
  }
}

// ===== فحص البنية الأساسية =====
function structuralCheck(html) {
  const issues = [];
  const checks = {
    'DOCTYPE html5': html.includes('<!DOCTYPE html>'),
    'وسم <html>': /<html[\s>]/i.test(html),
    'وسم <head>': /<head[\s>]/i.test(html),
    'وسم <title>': /<title[\s>]/i.test(html),
    'وسم <body>': /<body[\s>]/i.test(html),
    'وسم <meta charset>': /<meta[^>]+charset=/i.test(html),
    'إغلاق <html>': html.includes('</html>'),
    'إغلاق <body>': html.includes('</body>'),
    'إغلاق <head>': html.includes('</head>'),
    'سمة lang': /<html[^>]+lang=/i.test(html)
  };
  for (const [name, ok] of Object.entries(checks)) {
    if (!ok) issues.push({ type: 'structure', message: `ناقص: ${name}`, severity: 'error' });
  }
  // فحص الأقواس
  const opens = (html.match(/<div[\s>]/g) || []).length;
  const closes = (html.match(/<\/div>/g) || []).length;
  if (opens !== closes) {
    issues.push({ type: 'structure', message: `عدم تطابق <div>: فتح ${opens} / إغلاق ${closes}`, severity: 'error' });
  }
  return issues;
}

// ===== فحص الروابط والصور المحلية =====
function assetCheck(html, baseDir) {
  const issues = [];
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  const checks = [...html.matchAll(imgRe)].map(m => ({ ref: m[1], kind: 'صورة' }))
    .concat([...html.matchAll(linkRe)].map(m => ({ ref: m[1], kind: 'رابط' })))
    .concat([...html.matchAll(scriptRe)].map(m => ({ ref: m[1], kind: 'سكربت' })));
  for (const { ref, kind } of checks) {
    if (ref.startsWith('http') || ref.startsWith('data:') || ref.startsWith('#')) continue;
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean) continue;
    const fullPath = resolve(baseDir, clean);
    if (!existsSync(fullPath)) {
      issues.push({ type: 'asset', message: `${kind} غير موجودة: ${ref}`, severity: 'error' });
    }
  }
  return issues;
}

// ===== التقرير =====
function generateReport(filePath, lintHints, structIssues, assetIssues) {
  const total = lintHints.length + structIssues.length + assetIssues.length;
  const errors = lintHints.filter(h => h.type === 'error').length + structIssues.length + assetIssues.length;
  const warnings = lintHints.filter(h => h.type === 'warning').length;
  
  if (jsonOutput) {
    return JSON.stringify({ file: filePath, total, errors, warnings, lint: lintHints, structure: structIssues, assets: assetIssues }, null, 2);
  }

  const lines = [];
  const name = filePath.split('/').pop();
  lines.push('');
  lines.push(`${C.bold}${C.cyan}═══════════════════════════════════════════${C.reset}`);
  lines.push(`${C.bold}${C.cyan}  📄 فحص: ${name}${C.reset}`);
  lines.push(`${C.bold}${C.cyan}═══════════════════════════════════════════${C.reset}`);
  
  if (structIssues.length > 0) {
    lines.push(`\n${C.bold}${C.yellow}📐 البنية الأساسية:${C.reset}`);
    for (const i of structIssues) lines.push(`  ${C.red}❌${C.reset} ${i.message}`);
  } else {
    lines.push(`\n${C.bold}${C.green}📐 البنية الأساسية: سليمة ✓${C.reset}`);
  }
  
  if (assetIssues.length > 0) {
    lines.push(`\n${C.bold}${C.yellow}📎 الموارد (صور/روابط/سكربتات):${C.reset}`);
    for (const i of assetIssues) lines.push(`  ${C.red}❌${C.reset} ${i.message}`);
  } else {
    lines.push(`\n${C.bold}${C.green}📎 الموارد: كلها موجودة ✓${C.reset}`);
  }
  
  if (lintHints.length > 0) {
    lines.push(`\n${C.bold}${C.yellow}🔍 نتائج HTMLHint:${C.reset}`);
    for (const h of lintHints.slice(0, 30)) {
      const sev = h.type === 'error' ? `${C.red}خطأ${C.reset}` : `${C.yellow}تحذير${C.reset}`;
      lines.push(`  ${h.type === 'error' ? '❌' : '⚠️'} [سطر ${h.line}:${h.col}] ${h.message} (${h.rule.id})`);
    }
    if (lintHints.length > 30) lines.push(`  ${C.dim}... و ${lintHints.length - 30} إضافية${C.reset}`);
  } else {
    lines.push(`\n${C.bold}${C.green}🔍 HTMLHint: لا توجد مشاكل ✓${C.reset}`);
  }
  
  const score = total === 0 ? 100 : Math.max(0, Math.round((1 - errors / Math.max(1, errors + warnings + 1)) * 100));
  lines.push(`\n${C.bold}${'─'.repeat(45)}${C.reset}`);
  lines.push(`  ${C.bold}الإجمالي: ${total === 0 ? C.green + '0 مشاكل ✓' : C.red + total + ' مشاكل' + C.reset}`);
  lines.push(`  ${C.bold}التقييم: ${score >= 90 ? C.green + 'ممتاز' : score >= 70 ? C.yellow + 'جيد' : C.red + 'يحتاج تحسين'} (${score}%)${C.reset}`);
  lines.push(`${C.bold}${'─'.repeat(45)}${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

// ===== التنفيذ =====
const allFiles = collectFiles(files);
if (allFiles.length === 0) {
  console.log(`${C.red}لا توجد ملفات HTML للفحص${C.reset}`);
  process.exit(1);
}

let grandTotal = 0;
let allReports = [];
for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  const lint = HTMLHint.verify(content, {
    'tagname-lowercase': true,
    'attr-lowercase': true,
    'attr-value-double-quotes': true,
    'doctype-first': true,
    'tag-pair': true,
    'spec-char-escape': true,
    'id-unique': true,
    'src-not-empty': true,
    'attr-no-duplication': true,
    'title-require': true,
    'alt-require': true
  }).map(h => ({ ...h, type: h.type || 'warning' }));
  
  const struct = structuralCheck(content);
  const assets = assetCheck(content, resolve(file, '..'));
  grandTotal += lint.length + struct.length + assets.length;
  
  const report = generateReport(file, lint, struct, assets);
  if (jsonOutput) {
    allReports.push(JSON.parse(report));
  } else {
    console.log(report);
  }
}

if (jsonOutput) {
  console.log(JSON.stringify({ files: allReports.length, total: grandTotal, reports: allReports }, null, 2));
} else if (allFiles.length > 1) {
  console.log(`${C.bold}${C.cyan}📊 الإجمالي: ${allFiles.length} ملفات - ${grandTotal} مشاكل${C.reset}`);
}
