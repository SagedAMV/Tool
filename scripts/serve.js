#!/usr/bin/env node
/**
 * serve.js - خادم معاينة بصري لملفات HTML
 * يعرض ملفات HTML في المتصفح مع إعادة تحميل تلقائي
 * 
 * الاستعمال:
 *   node scripts/serve.js              (يخدم المجلد الحالي)
 *   node scripts/serve.js ../my-app/   (يخدم مجلد محدد)
 *   node scripts/serve.js --port 3000  (منفذ مخصص)
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, extname, join, relative } from 'path';
import { URL } from 'url';

const CWD = process.cwd();
const args = process.argv.slice(2);
const PORT = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || 
             args[args.indexOf('--port') + 1] || '8080', 10);
const DIR = args.find(a => !a.startsWith('--') && args.indexOf(a) !== 0) || '.';
const rootDir = resolve(CWD, DIR);

// أنواع MIME
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

// صفحة قائمة الملفات
function listDir(dirPath, reqPath) {
  const items = readdirSync(dirPath, { withFileTypes: true });
  const files = items.filter(i => i.name.endsWith('.html') || i.name.endsWith('.htm') || i.isDirectory());
  let html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>📂 المعاينة - ${relative(rootDir, dirPath) || '.'}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,sans-serif}
    body{background:#f5f6fb;color:#1a1a2e;padding:20px;max-width:800px;margin:0 auto}
    h1{font-size:20px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .folder{margin-bottom:20px;background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
    .folder h2{font-size:13px;color:#636e72;margin-bottom:8px;display:flex;gap:6px}
    .file{display:flex;align-items:center;padding:10px 12px;border-radius:12px;cursor:pointer;transition:all .2s;text-decoration:none;color:#1a1a2e;margin:4px 0;border:1px solid #e2e5ef}
    .file:hover{background:#eef0ff;border-color:#a29bfe;transform:translateY(-1px)}
    .file .icon{font-size:24px;margin-left:12px}
    .file .name{font-weight:700;font-size:14px;flex:1}
    .file .size{font-size:11px;color:#a0a4b8}
    .folder-row{display:flex;align-items:center;padding:8px;color:#636e72;font-size:13px;cursor:pointer;gap:8px;border-radius:8px;margin:2px 0;transition:all .2s;text-decoration:none}
    .folder-row:hover{background:#eef0ff;color:#6c5ce7}
    .back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;border-radius:10px;text-decoration:none;color:#636e72;font-size:12px;margin-bottom:16px;border:1px solid #e2e5ef}
  </style></head><body>
  <h1>📂 ${relative(rootDir, dirPath) || 'المجلد الرئيسي'}</h1>`;
  
  if (reqPath !== '/') {
    const parent = resolve(dirPath, '..');
    const rel = relative(rootDir, parent);
    html += `<a href="/${rel}" class="back">⬅️ الرجوع</a>`;
  }
  
  const folders = files.filter(i => i.isDirectory());
  const htmlFiles = files.filter(i => i.name.endsWith('.html') || i.name.endsWith('.htm'));
  
  if (folders.length > 0) {
    html += `<div class="folder"><h2>📁 مجلدات</h2>`;
    for (const f of folders) {
      const relPath = relative(rootDir, resolve(dirPath, f.name));
      html += `<a href="/${relPath}" class="folder-row">📁 ${f.name}</a>`;
    }
    html += `</div>`;
  }
  
  if (htmlFiles.length > 0) {
    html += `<div class="folder"><h2>📄 ملفات HTML</h2>`;
    for (const f of htmlFiles) {
      const relPath = relative(rootDir, resolve(dirPath, f.name));
      const st = statSync(resolve(dirPath, f.name));
      const size = st.size < 1024 ? `${st.size} B` : `${(st.size/1024).toFixed(0)} KB`;
      html += `<a href="/${relPath}" target="_blank" class="file">
        <span class="icon">🌐</span>
        <span class="name">${f.name}</span>
        <span class="size">${size}</span>
      </a>`;
    }
    html += `</div>`;
  }
  
  html += `</body></html>`;
  return html;
}

// الخادم
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  let reqPath = decodeURIComponent(url.pathname);
  
  let filePath = resolve(rootDir, '.' + reqPath);
  
  // إذا كان الملف مفقوداً، حاول index.html
  if (!existsSync(filePath)) {
    const indexPath = join(filePath, 'index.html');
    if (existsSync(indexPath)) {
      filePath = indexPath;
    }
  }
  
  if (!existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(listDir(resolve(rootDir, '.' + reqPath), reqPath));
    return;
  }
  
  const st = statSync(filePath);
  if (st.isDirectory()) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(listDir(filePath, reqPath));
    return;
  }
  
  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-cache'
  });
  res.end(content);
});

server.listen(PORT, () => {
  const addr = `http://localhost:${PORT}`;
  console.log(`\n  🌐 ${'='.repeat(40)}`);
  console.log(`  🌐  خادم المعاينة البصري`);
  console.log(`  🌐  المجلد: ${rootDir}`);
  console.log(`  🌐  الرابط: ${addr}`);
  console.log(`  🌐  اضغط Ctrl+C للإيقاف`);
  console.log(`  🌐 ${'='.repeat(40)}\n`);
});