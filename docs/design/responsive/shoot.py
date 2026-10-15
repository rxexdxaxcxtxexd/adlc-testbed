"""Screenshot and measure every COI Check screen at nine viewport sizes.

Run after `node scripts/build-preview.js` and with the preview served:
    python3 -m http.server 8766 -d docs/design/refined/app
    python3 docs/design/responsive/shoot.py [base_url] [out_dir]

Writes PNGs to out_dir/<w>x<h>/<screen>.png and a metrics file to
docs/design/responsive/metrics.json. Development tooling only; never deployed.
"""
import glob
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8766"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.getcwd(), "shots")
HERE = os.path.dirname(os.path.abspath(__file__))
SIZES = [(375, 812), (430, 932), (768, 1024), (1024, 768), (820, 1180), (1180, 820), (1280, 800), (1440, 900), (1920, 1080)]
TOUCH_MAX = 1180  # phone and iPad sizes get hasTouch/isMobile
SCREENS = ["projects", "dashboard", "worklist", "holds", "directory", "notifications", "trust", "record", "about"]

MEASURE = r"""
() => {
  const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement;
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const label = el => (el.getAttribute('aria-label') || el.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"])';
  const small = [];
  document.querySelectorAll(sel).forEach(el => {
    if (!vis(el)) return;
    if (el.type === 'file') return;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) small.push({el: name(el), text: label(el), w: Math.round(r.width), h: Math.round(r.height)});
  });
  const overflow = [];
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1) {
      // skip children whose clipping ancestor scrolls or hides overflow
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
      if (!clipped) overflow.push({el: name(el), right: Math.round(r.right), w: Math.round(r.width)});
    }
  });
  const inner = [];
  document.querySelectorAll('.table-scroll,.seg,.checks,.note-track,dialog,.ct-card').forEach(el => {
    if (vis(el) && el.scrollWidth > el.clientWidth + 1) inner.push({el: name(el), scroll: el.scrollWidth, client: el.clientWidth});
  });
  const inputs = [];
  document.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea').forEach(el => {
    if (!vis(el)) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) inputs.push({el: name(el), px: fs});
  });
  const sticky = [];
  document.querySelectorAll('.pagehead,.side,.notice').forEach(el => {
    if (!vis(el)) return; const r = el.getBoundingClientRect(); sticky.push({el: name(el), w: Math.round(r.width), h: Math.round(r.height)});
  });
  const main = document.getElementById('content') || document.querySelector('main');
  return {vw, vh, scrollWidth: de.scrollWidth, hscroll: Math.max(0, de.scrollWidth - vw), docHeight: de.scrollHeight,
    mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
    smallTargets: small.length, smallSample: small.slice(0, 40), overflow: overflow.slice(0, 15), innerScroll: inner,
    smallInputs: inputs, chrome: sticky};
}
"""


def idle(page):
    page.wait_for_function("() => { const v = document.getElementById('view'); return v && v.getAttribute('aria-busy') === 'false'; }", timeout=15000)
    page.wait_for_timeout(500)


def shot(page, d, name, full=True):
    page.screenshot(path=os.path.join(d, name + ".png"))
    if full:
        page.screenshot(path=os.path.join(d, name + "-full.png"), full_page=True)


def run():
    exe = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe[-1] if exe else None, args=["--no-sandbox"])
        for w, h in SIZES:
            key = f"{w}x{h}"
            d = os.path.join(OUT, key)
            os.makedirs(d, exist_ok=True)
            res = results[key] = {}
            touch = w <= TOUCH_MAX
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
            ctx.add_init_script("try { localStorage.setItem('coi.tour.seen','1'); } catch (e) {}")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/index.html")
            idle(page)
            for s in SCREENS:
                page.evaluate(f"window.coiApp.go('{s}')")
                page.wait_for_timeout(300)
                idle(page)
                page.wait_for_timeout(400)
                res[s] = page.evaluate(MEASURE)
                shot(page, d, s)
                if s == "record":
                    # PDF panel open, then the correction dialog
                    if page.evaluate("!document.getElementById('pdf-panel').open"):
                        page.click("#pdf-panel summary")
                    page.wait_for_timeout(1500)
                    page.evaluate("document.getElementById('pdf-panel').scrollIntoView({block:'start'})")
                    page.wait_for_timeout(300)
                    shot(page, d, "record-pdf", full=False)
                    res["record-pdf"] = page.evaluate(MEASURE)
                    page.evaluate("window.scrollTo(0,0)")
                    btn = page.query_selector("#correct")
                    if btn:
                        btn.click()
                        page.wait_for_timeout(600)
                        res["dialog"] = page.evaluate(MEASURE)
                        shot(page, d, "dialog", full=False)
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(300)
                if s == "directory":
                    link = page.query_selector("#dir-rows .link-btn")
                    if link:
                        link.click(); idle(page)
                        res["company"] = page.evaluate(MEASURE)
                        shot(page, d, "company")
                if s == "notifications":
                    items = page.query_selector_all(".note-item")
                    if len(items) > 1:
                        items[1].click(); page.wait_for_timeout(500)
                        page.evaluate("document.getElementById('note-preview').scrollIntoView({block:'start'})")
                        page.wait_for_timeout(300)
                        res["notification-detail"] = page.evaluate(MEASURE)
                        shot(page, d, "notification-detail", full=False)
            # sidebar expanded (narrow widths start collapsed)
            page.evaluate("window.coiApp.go('worklist')"); idle(page)
            if page.evaluate("document.getElementById('side').classList.contains('closed')"):
                page.click("#side-expand"); page.wait_for_timeout(500)
                res["sidebar-open"] = page.evaluate(MEASURE)
                shot(page, d, "sidebar-open", full=False)
            res["_errors"] = errors
            ctx.close()

            # welcome card on a first visit
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
            page = ctx.new_page()
            page.goto(BASE + "/index.html"); idle(page); page.wait_for_timeout(2600)
            res["welcome"] = page.evaluate(MEASURE)
            shot(page, d, "welcome", full=False)
            # walk the tour by hand: Show me around, then Next to the end
            tour = {"steps": [], "completed": False}
            start = page.query_selector('[data-w="start"]')
            if start:
                start.click()
                for i in range(12):
                    page.wait_for_timeout(1800)
                    info = page.evaluate("""() => { const c = document.querySelector('.ct-card'); const r = c ? c.getBoundingClientRect() : null;
                      const ring = document.querySelector('.ct-ring'); const rr = ring ? ring.getBoundingClientRect() : null;
                      return {count: (document.getElementById('ct-count')||{}).textContent || '', card: r && {top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right)},
                        docked: c ? c.classList.contains('ct-docked') : false, final: c ? c.classList.contains('ct-final') : false,
                        ring: rr && {top: Math.round(rr.top), bottom: Math.round(rr.bottom), h: Math.round(rr.height)}, vh: innerHeight, vw: innerWidth}; }""")
                    tour["steps"].append(info)
                    shot(page, d, f"tour-{i + 1}", full=False)
                    if info["final"]:
                        tour["completed"] = True
                        break
                    nb = page.query_selector(".ct-next")
                    if not nb or not nb.is_visible():
                        break
                    nb.click()
            res["tour"] = tour
            ctx.close()

            # autoplay start from the URL flag
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
            page = ctx.new_page()
            page.goto(BASE + "/index.html?tour=play"); idle(page); page.wait_for_timeout(2500)
            shot(page, d, "tour-play", full=False)
            ctx.close()

            # upload page: empty, file chosen, progress
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
            page = ctx.new_page()
            page.goto(BASE + "/upload.html"); page.wait_for_timeout(1200)
            res["upload"] = page.evaluate(MEASURE)
            shot(page, d, "upload")
            page.set_input_files("#file", os.path.join(HERE, "..", "refined", "app", "sample-certificate.pdf"))
            page.wait_for_timeout(500)
            res["upload-chosen"] = page.evaluate(MEASURE)
            shot(page, d, "upload-chosen", full=False)
            page.click("#send"); page.wait_for_timeout(4000)
            res["upload-progress"] = page.evaluate(MEASURE)
            shot(page, d, "upload-progress", full=False)
            page.goto(BASE + "/upload.html?state=inactive"); page.wait_for_timeout(800)
            shot(page, d, "upload-inactive", full=False)
            ctx.close()
            print(key, "done", "errors:", len(errors))
        browser.close()
    with open(os.path.join(HERE, "metrics.json"), "w") as f:
        json.dump(results, f, indent=1)


if __name__ == "__main__":
    run()
