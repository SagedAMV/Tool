#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
htmlcheck - أداة محاكاة وفحص ملفات HTML بمتصفح حقيقي (Chromium/Playwright)

ماذا تفعل؟
  1. تفتح ملف HTML (أو رابط) في متصفح حقيقي.
  2. تلتقط لقطات شاشة بأحجام متعددة (موبايل / تابلت / سطح مكتب).
  3. تضغط كل الأزرار والروابط الداخلية فعلياً وتسجل ما حدث.
  4. تجمع أخطاء الجافاسكربت وأخطاء الكونسول وطلبات الشبكة الفاشلة.
  5. تفحص التنسيق: تجاوز أفقي، عناصر خارج الشاشة، عناصر متداخلة،
     نصوص صغيرة جداً، أزرار صغيرة على الجوال، صور بلا alt، تباين ألوان ضعيف.
  6. تُخرج تقرير HTML + JSON فيه كل اللقطات والملاحظات.

الاستخدام:
    python htmlcheck.py index.html
    python htmlcheck.py index.html -o report_dir --no-click
    python htmlcheck.py https://example.com --viewport 1440x900
"""

import argparse
import asyncio
import base64
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

try:
    from playwright.async_api import async_playwright
except ImportError:
    sys.exit("ثبّت أولاً:  pip install playwright && python -m playwright install chromium")

DEFAULT_VIEWPORTS = [
    ("mobile", 390, 844, True),
    ("tablet", 820, 1180, True),
    ("desktop", 1440, 900, False),
]

# ---------- سكربت الفحص داخل الصفحة ----------
AUDIT_JS = r"""
() => {
  const out = {overflow:[], tiny_text:[], small_tap:[], no_alt:[], offscreen:[],
               overlap:[], contrast:[], counts:{}, title:document.title||"",
               lang:document.documentElement.lang||"", viewport_meta:!!document.querySelector('meta[name=viewport]')};
  const vw = window.innerWidth, vh = window.innerHeight;
  const sel = (el) => {
    if (el.id) return '#'+el.id;
    let p = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string')
      p += '.' + el.className.trim().split(/\s+/).slice(0,2).join('.');
    return p;
  };
  const parseRGB = c => { const m=(c||'').match(/[\d.]+/g); return m? m.slice(0,3).map(Number):null; };
  const lum = rgb => { const a=rgb.map(v=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);});
                       return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; };
  const bgOf = el => { let n=el; while(n && n!==document.documentElement){ const c=getComputedStyle(n).backgroundColor;
      const p=parseRGB(c); if(p && !/rgba\(.*,\s*0\)/.test(c)) return p; n=n.parentElement;} return [255,255,255]; };

  const all = Array.from(document.querySelectorAll('*'));
  out.counts.elements = all.length;
  const boxes = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;

    // تجاوز أفقي
    if (r.right > vw + 2 || r.left < -2) out.overflow.push({sel:sel(el), left:Math.round(r.left), right:Math.round(r.right), vw});
    // خارج الشاشة تماماً
    if (r.right < 0 || r.bottom < 0) out.offscreen.push({sel:sel(el)});
    // نص صغير
    const fs = parseFloat(cs.fontSize);
    const txt = (el.childElementCount === 0 ? (el.textContent||'').trim() : '');
    if (txt && fs && fs < 11) out.tiny_text.push({sel:sel(el), size:fs, text:txt.slice(0,40)});
    // تباين
    if (txt && txt.length > 2) {
      const fg = parseRGB(cs.color), bg = bgOf(el);
      if (fg) { const l1=lum(fg), l2=lum(bg);
        const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        const big = fs>=24 || (fs>=18.66 && parseInt(cs.fontWeight)>=700);
        if (ratio < (big?3:4.5)) out.contrast.push({sel:sel(el), ratio:+ratio.toFixed(2),
            need: big?3:4.5, color:cs.color, bg:'rgb('+bg.join(',')+')', text:txt.slice(0,40)});
      }
    }
    // أهداف لمس صغيرة
    const tag = el.tagName.toLowerCase();
    const clickable = tag==='button'||tag==='a'||(tag==='input'&&['button','submit','checkbox','radio'].includes(el.type))||el.getAttribute('role')==='button'||cs.cursor==='pointer';
    if (clickable && (r.width < 44 || r.height < 44))
      out.small_tap.push({sel:sel(el), w:Math.round(r.width), h:Math.round(r.height)});
    if (tag==='img' && !el.getAttribute('alt')) out.no_alt.push({sel:sel(el), src:(el.currentSrc||el.src||'').slice(-60)});
    if (clickable) boxes.push({sel:sel(el), r:{x:r.x,y:r.y,w:r.width,h:r.height}});
  }
  // تداخل بين العناصر القابلة للنقر
  for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++){
    const a=boxes[i].r,b=boxes[j].r;
    const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if (ox>4 && oy>4) { out.overlap.push({a:boxes[i].sel,b:boxes[j].sel,area:Math.round(ox*oy)}); }
    if (out.overlap.length>30) break;
  }
  out.counts.scrollWidth = document.documentElement.scrollWidth;
  out.counts.clientWidth = document.documentElement.clientWidth;
  out.counts.buttons = document.querySelectorAll('button,[role=button],input[type=button],input[type=submit]').length;
  out.counts.links = document.querySelectorAll('a[href]').length;
  out.counts.images = document.querySelectorAll('img').length;
  out.counts.forms = document.querySelectorAll('form').length;
  return out;
}
"""

CLICKABLE_SEL = "button, [role=button], input[type=button], input[type=submit], a[href], [onclick], summary, .btn, label[for]"


class Recorder:
    def __init__(self):
        self.console = []
        self.errors = []
        self.requests = []

    def attach(self, page):
        page.on("console", lambda m: self.console.append(
            {"type": m.type, "text": m.text[:300], "loc": str(m.location.get("url", ""))[-80:]}))
        page.on("pageerror", lambda e: self.errors.append({"text": str(e)[:400]}))
        page.on("requestfailed", lambda r: self.requests.append(
            {"url": r.url[-100:], "err": (r.failure or "")}))
        page.on("response", lambda r: self.requests.append(
            {"url": r.url[-100:], "err": f"HTTP {r.status}"}) if r.status >= 400 else None)


async def snapshot_state(page):
    return await page.evaluate("""() => ({
        url: location.href, title: document.title,
        html_len: document.body ? document.body.innerHTML.length : 0,
        text: (document.body ? document.body.innerText : '').slice(0, 4000),
        scrollY: window.scrollY
    })""")


async def run_clicks(page, rec, shots_dir, limit=40, timeout_ms=1500):
    """يضغط كل عنصر قابل للنقر ويسجل التغيير الحاصل."""
    results = []
    handles = await page.query_selector_all(CLICKABLE_SEL)
    total = len(handles)
    for idx in range(min(total, limit)):
        handles = await page.query_selector_all(CLICKABLE_SEL)
        if idx >= len(handles):
            break
        el = handles[idx]
        try:
            if not await el.is_visible():
                continue
            info = await el.evaluate("""e => ({tag:e.tagName.toLowerCase(),
                 text:(e.innerText||e.value||e.getAttribute('aria-label')||'').trim().slice(0,60),
                 href:e.getAttribute('href')||'', disabled: !!e.disabled})""")
        except Exception:
            continue
        if info.get("disabled"):
            results.append({**info, "index": idx, "result": "معطّل (disabled) - تم تخطيه"})
            continue
        href = info.get("href", "")
        if href.startswith(("http://", "https://", "mailto:", "tel:")):
            results.append({**info, "index": idx, "result": f"رابط خارجي، لم يُضغط: {href}"})
            continue

        before = await snapshot_state(page)
        err_before, con_before = len(rec.errors), len(rec.console)
        shot = None
        try:
            await el.scroll_into_view_if_needed(timeout=1000)
            await el.click(timeout=timeout_ms, force=False)
            await page.wait_for_timeout(400)
            after = await snapshot_state(page)
            changed = []
            if after["url"] != before["url"]:
                changed.append(f"تغيّر العنوان إلى {after['url'][-60:]}")
            if abs(after["html_len"] - before["html_len"]) > 20:
                changed.append(f"تغيّر محتوى DOM ({before['html_len']} → {after['html_len']})")
            if after["text"] != before["text"]:
                changed.append("تغيّر النص الظاهر")
            new_err = rec.errors[err_before:]
            status = "؛ ".join(changed) if changed else "لا تغيير ملحوظ (قد يكون الزر بلا وظيفة)"
            if new_err:
                status += " | ❌ خطأ JS: " + new_err[0]["text"][:120]
            name = f"click_{idx:02d}.png"
            await page.screenshot(path=str(shots_dir / name))
            shot = name
            results.append({**info, "index": idx, "result": status, "shot": shot,
                            "js_errors": [e["text"] for e in new_err],
                            "new_console": [c for c in rec.console[con_before:] if c["type"] in ("error", "warning")]})
            if after["url"] != before["url"]:
                await page.go_back(wait_until="load")
                await page.wait_for_timeout(300)
        except Exception as ex:
            results.append({**info, "index": idx, "result": f"فشل الضغط: {str(ex)[:120]}"})
    return results, total


async def audit(target, outdir, viewports, do_clicks=True, click_limit=40, wait=1200):
    outdir = Path(outdir)
    shots = outdir / "shots"
    shots.mkdir(parents=True, exist_ok=True)
    url = target if re.match(r"^https?://", target) else Path(target).resolve().as_uri()

    report = {"target": target, "url": url, "time": datetime.now().isoformat(timespec="seconds"),
              "viewports": [], "clicks": [], "console": [], "errors": [], "network": []}

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        for name, w, h, mobile in viewports:
            rec = Recorder()
            ctx = await browser.new_context(viewport={"width": w, "height": h},
                                            is_mobile=mobile, has_touch=mobile,
                                            device_scale_factor=2 if mobile else 1)
            page = await ctx.new_page()
            rec.attach(page)
            t0 = time.time()
            try:
                await page.goto(url, wait_until="load", timeout=30000)
            except Exception as e:
                report["errors"].append({"text": f"فشل التحميل [{name}]: {e}"})
                await ctx.close()
                continue
            await page.wait_for_timeout(wait)
            load_ms = int((time.time() - t0) * 1000)

            a = await page.evaluate(AUDIT_JS)
            fold = f"{name}_fold.png"
            full = f"{name}_full.png"
            await page.screenshot(path=str(shots / fold))
            await page.screenshot(path=str(shots / full), full_page=True)

            vp = {"name": name, "w": w, "h": h, "mobile": mobile, "load_ms": load_ms,
                  "audit": a, "shot_fold": fold, "shot_full": full}
            report["viewports"].append(vp)

            if do_clicks and name == "desktop":
                clicks, total = await run_clicks(page, rec, shots, limit=click_limit)
                report["clicks"] = clicks
                report["clickable_total"] = total

            report["console"] += [{**c, "vp": name} for c in rec.console]
            report["errors"] += [{**e, "vp": name} for e in rec.errors]
            report["network"] += [{**r, "vp": name} for r in rec.requests]
            await ctx.close()
        await browser.close()

    (outdir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_html_report(report, outdir)
    return report


def _img(outdir, name):
    p = outdir / "shots" / name
    if not p.exists():
        return ""
    b = base64.b64encode(p.read_bytes()).decode()
    return f"data:image/png;base64,{b}"


def write_html_report(r, outdir):
    outdir = Path(outdir)
    css = """body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:#0f1115;color:#e6e6e6;margin:0;padding:24px;direction:rtl}
h1,h2,h3{color:#7dd3fc} .card{background:#171a21;border:1px solid #262b35;border-radius:12px;padding:16px;margin:14px 0}
img{max-width:100%;border-radius:8px;border:1px solid #2a2f3a;background:#fff}
table{width:100%;border-collapse:collapse;font-size:14px} td,th{border-bottom:1px solid #262b35;padding:6px 8px;text-align:right;vertical-align:top}
.bad{color:#f87171}.warn{color:#fbbf24}.ok{color:#4ade80}.mono{font-family:ui-monospace,monospace;font-size:12px;color:#9ca3af}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.pill{display:inline-block;background:#1f2937;border-radius:999px;padding:2px 10px;margin:2px;font-size:12px}
details summary{cursor:pointer;color:#7dd3fc;margin:6px 0}"""
    h = [f"<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><title>تقرير فحص HTML</title><style>{css}</style>"]
    h.append(f"<h1>تقرير فحص: {r['target']}</h1><p class=mono>{r['url']}<br>{r['time']}</p>")

    errs, warns = r["errors"], [c for c in r["console"] if c["type"] == "error"]
    net = [n for n in r["network"] if n.get("err")]
    h.append("<div class=card><h2>الخلاصة</h2>")
    h.append(f"<span class=pill>{'❌' if errs else '✅'} أخطاء JS: {len(errs)}</span>")
    h.append(f"<span class=pill>أخطاء كونسول: {len(warns)}</span>")
    h.append(f"<span class=pill>{'⚠️' if net else '✅'} طلبات فاشلة: {len(net)}</span>")
    h.append(f"<span class=pill>عناصر ضُغطت: {len(r.get('clicks', []))} / {r.get('clickable_total', 0)}</span></div>")

    for v in r["viewports"]:
        a = v["audit"]
        h.append(f"<div class=card><h2>{v['name']} — {v['w']}×{v['h']} ({v['load_ms']} ms)</h2>")
        h.append("<p>" + " ".join(
            f"<span class=pill>{k}: {val}</span>" for k, val in a["counts"].items()) + "</p>")
        if not a["viewport_meta"]:
            h.append("<p class=warn>⚠️ لا يوجد meta viewport — الموقع لن يتجاوب على الجوال.</p>")
        if not a["lang"]:
            h.append("<p class=warn>⚠️ لا يوجد lang في وسم html.</p>")
        issues = [("تجاوز أفقي (عناصر خارج عرض الشاشة)", a["overflow"], "bad"),
                  ("نص صغير جداً (<11px)", a["tiny_text"], "warn"),
                  ("أزرار/روابط أصغر من 44px", a["small_tap"], "warn"),
                  ("صور بلا alt", a["no_alt"], "warn"),
                  ("تباين ألوان ضعيف", a["contrast"], "warn"),
                  ("عناصر قابلة للنقر متداخلة", a["overlap"], "warn")]
        for title, items, cls in issues:
            if items:
                h.append(f"<details><summary class={cls}>{title}: {len(items)}</summary><table>")
                for it in items[:25]:
                    h.append("<tr>" + "".join(f"<td class=mono>{str(x)[:80]}</td>" for x in it.values()) + "</tr>")
                h.append("</table></details>")
        h.append("<div class=grid>")
        h.append(f"<div><h3>الشاشة الأولى</h3><img src='{_img(outdir, v['shot_fold'])}'></div>")
        h.append(f"<div><h3>الصفحة كاملة</h3><img src='{_img(outdir, v['shot_full'])}'></div>")
        h.append("</div></div>")

    if r.get("clicks"):
        h.append("<div class=card><h2>نتائج الضغط الفعلي على الأزرار</h2><table>"
                 "<tr><th>#</th><th>العنصر</th><th>النص</th><th>النتيجة</th></tr>")
        for c in r["clicks"]:
            cls = "bad" if "خطأ" in c["result"] or "فشل" in c["result"] else (
                "warn" if "لا تغيير" in c["result"] else "ok")
            h.append(f"<tr><td>{c['index']}</td><td class=mono>{c['tag']}</td><td>{c.get('text','')}</td>"
                     f"<td class={cls}>{c['result']}</td></tr>")
        h.append("</table>")
        for c in r["clicks"]:
            if c.get("shot"):
                h.append(f"<details><summary>لقطة بعد الضغط على «{c.get('text') or c['tag']}»</summary>"
                         f"<img src='{_img(outdir, c['shot'])}'></details>")
        h.append("</div>")

    if errs or warns:
        h.append("<div class=card><h2>الأخطاء</h2><table>")
        for e in errs:
            h.append(f"<tr><td class=bad>JS</td><td class=mono>{e['text']}</td></tr>")
        for c in warns:
            h.append(f"<tr><td class=warn>console</td><td class=mono>{c['text']}</td></tr>")
        h.append("</table></div>")
    if net:
        h.append("<div class=card><h2>طلبات شبكة فاشلة</h2><table>")
        for n in net[:40]:
            h.append(f"<tr><td class=mono>{n['url']}</td><td class=bad>{n['err']}</td></tr>")
        h.append("</table></div>")

    h.append("</html>")
    (outdir / "report.html").write_text("\n".join(h), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="فحص ومحاكاة ملفات HTML بمتصفح حقيقي")
    ap.add_argument("target", help="مسار ملف HTML أو رابط")
    ap.add_argument("-o", "--out", default="htmlcheck_report", help="مجلد الإخراج")
    ap.add_argument("--no-click", action="store_true", help="بدون ضغط الأزرار")
    ap.add_argument("--limit", type=int, default=40, help="أقصى عدد أزرار تُضغط")
    ap.add_argument("--wait", type=int, default=1200, help="انتظار بعد التحميل (ms)")
    ap.add_argument("--viewport", action="append", help="مقاس مخصص مثل 1440x900")
    args = ap.parse_args()

    vps = DEFAULT_VIEWPORTS
    if args.viewport:
        vps = []
        for i, v in enumerate(args.viewport):
            w, hh = v.lower().split("x")
            vps.append((f"vp{i}_{w}x{hh}", int(w), int(hh), int(w) < 700))

    r = asyncio.run(audit(args.target, args.out, vps, not args.no_click, args.limit, args.wait))
    print(f"\n✅ تم. التقرير: {Path(args.out) / 'report.html'}")
    print(f"   أخطاء JS: {len(r['errors'])} | أزرار مُختبرة: {len(r.get('clicks', []))}")


if __name__ == "__main__":
    main()
