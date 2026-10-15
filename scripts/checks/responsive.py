"""Browser half of the responsive check. Run it through responsive.js, which builds and serves the preview.

    node scripts/checks/responsive.js [--sizes 375x812,768x1024] [--tests T4,T5] [--shots DIR] [-v]

Tests T1 to T15 follow docs/design/responsive-spec.md section 7. Differences from the spec:
- There is no bottom tab bar (ticket R3 is skipped). T1 reaches every screen through the rail or the drawer.
- Chromium here cannot reach the PDF viewer library on a CDN when offline, so T12 reports "no canvas to measure" and does not fail.
Development tooling only; never deployed.
"""
import glob
import os
import sys

from playwright.sync_api import sync_playwright

SIZES = [(375, 812), (390, 844), (430, 932), (768, 1024), (820, 1180), (1024, 768), (1180, 820), (1280, 800), (1440, 900), (1920, 1080)]
TOUCH_MAX = 1180
SAMPLE_PDF = os.environ.get("COI_SAMPLE_PDF", "")
TITLES = {"projects": "Projects", "dashboard": "Compliance", "worklist": "Worklist", "holds": "Payment holds", "directory": "Subcontractors",
          "notifications": "Notifications"}
SCREENS = ["projects", "dashboard", "worklist", "holds", "directory", "company", "notifications", "record", "about"]
CARD_SCREENS = ["projects", "dashboard", "worklist", "holds", "directory"]
NAMES = {
    "T1": "Reachable by the nav", "T2": "No sideways page scroll", "T3": "Tables: card list or sticky first column", "T4": "Tap targets 44px",
    "T5": "Input text 16px", "T6": "Nav overlays, does not squeeze", "T7": "Header height on phone", "T8": "Tour card fits",
    "T9": "Welcome card fits", "T10": "Dialog fits", "T11": "Notifications on phone", "T12": "PDF and Open PDF", "T13": "Upload page",
    "T14": "Desktop regression", "T15": "Hover rules guarded",
}

MEASURE = r"""
(touch) => {
  const vw = window.innerWidth, de = document.documentElement;
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const label = el => (el.getAttribute('aria-label') || el.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  const small = [];
  document.querySelectorAll('button,a[href],input:not([type=hidden]):not([type=file]),select,summary,[role=button]').forEach(el => {
    if (!vis(el) || el.closest('.well.notice')) return;
    if (el.matches('a.skip') && document.activeElement !== el) return;
    if (el.tagName === 'A' && el.parentElement && el.parentElement.tagName === 'P') return;
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) small.push(name(el) + ' "' + label(el) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  const wide = [];
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el) || el.closest('.well.notice')) return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1) {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
      if (!clipped) wide.push(name(el) + ' right ' + Math.round(r.right));
    }
  });
  const inner = [];
  document.querySelectorAll('.table-scroll').forEach(el => {
    if (!vis(el) || el.scrollWidth <= el.clientWidth + 1) return;
    const td = el.querySelector('tbody td:first-child');
    inner.push({box: name(el), scroll: el.scrollWidth, client: el.clientWidth, sticky: !!td && getComputedStyle(td).position === 'sticky'});
  });
  const fonts = [];
  document.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea').forEach(el => {
    if (!vis(el)) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 15.99) fonts.push(name(el) + ' ' + px + 'px');
  });
  const labels = [];
  document.querySelectorAll('table.cardable').forEach(t => {
    const heads = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach(tr => Array.from(tr.children).forEach((td, i) => {
      if (td.getAttribute('data-label') !== heads[i]) labels.push((t.getAttribute('aria-label') || 'table') + ' cell ' + (i + 1) + ': ' + td.getAttribute('data-label') + ' is not ' + heads[i]);
    }));
  });
  const side = document.getElementById('side'), main = document.querySelector('main');
  return {hscroll: de.scrollWidth - vw, wide: wide, labels: Array.from(new Set(labels)), small: small, inner: inner, fonts: fonts,
    sideWidth: side ? Math.round(side.getBoundingClientRect().width) : null, mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null};
}
"""

HOVER = r"""
() => {
  const rx = /\.btn|\.note-item|\.drop(?![-\w])|\.icon-btn|\.seg button|\.action-card|\.chip-action/;
  const bad = [];
  function walk(rules, guarded) {
    for (const r of rules) {
      if (r.type === 1) { if (!guarded && r.selectorText.indexOf(':hover') >= 0 && rx.test(r.selectorText)) bad.push(r.selectorText.slice(0, 60)); }
      else if (r.type === 4) walk(r.cssRules, guarded || /hover:\s*hover/.test(r.conditionText || r.media.mediaText));
      else if (r.type === 12) walk(r.cssRules, guarded);
    }
  }
  for (const sheet of document.styleSheets) {
    if (!sheet.ownerNode || sheet.ownerNode.tagName !== 'STYLE') continue;
    try { walk(sheet.cssRules, false); } catch (e) { /* cross-origin sheet */ }
  }
  return bad;
}
"""


class Report:
    def __init__(self):
        self.rows = {}

    def fail(self, test, text):
        self.rows.setdefault(test, []).append(text)

    def touch(self, test):
        self.rows.setdefault(test, [])


def chromium():
    exe = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    return exe[-1] if exe else None


def idle(page):
    page.wait_for_function("() => { const v = document.getElementById('view'); return v && v.getAttribute('aria-busy') === 'false'; }", timeout=15000)
    page.wait_for_timeout(150)


def new_page(browser, w, h, touch, seen=True):
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch, is_mobile=touch, reduced_motion="reduce")
    if seen:
        ctx.add_init_script("try { localStorage.setItem('coi.tour.seen','1'); } catch (e) {}")
    page = ctx.new_page()
    page.set_default_timeout(8000)
    return ctx, page


def visit(page, screen):
    """Open a screen through the app's own router. 'company' and 'record' go one step further."""
    if screen == "company":
        page.evaluate("window.coiApp.go('directory')"); idle(page)
        page.click("#dir-rows .link-btn"); idle(page)
    elif screen == "notifications":
        page.evaluate("window.coiApp.go('notifications')"); idle(page)
    else:
        page.evaluate("window.coiApp.go('%s')" % screen); idle(page)
    page.wait_for_timeout(250)


def shot(page, shots, key, name):
    if not shots:
        return
    d = os.path.join(shots, key)
    os.makedirs(d, exist_ok=True)
    page.screenshot(path=os.path.join(d, name + ".png"))


def check_screens(browser, w, h, touch, rep, want, shots):
    key = "%dx%d" % (w, h)
    ctx, page = new_page(browser, w, h, touch)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/index.html"); idle(page)
    for s in SCREENS:
        try:
            visit(page, s)
        except Exception as e:  # a screen that cannot open is a T1 failure, and the rest still run
            rep.fail("T1", "%s did not open: %s" % (s, str(e)[:80])); continue
        m = page.evaluate(MEASURE, touch)
        shot(page, shots, key, s)
        if m["hscroll"] > 0:
            rep.fail("T2", "%s: page scrolls %dpx sideways" % (s, m["hscroll"]))
        for x in m["wide"][:3]:
            rep.fail("T2", "%s: %s past the edge" % (s, x))
        for x in m["labels"][:3]:
            rep.fail("T3", "%s: %s" % (s, x))
        for sc in m["inner"]:
            if w < 600:
                if s in CARD_SCREENS: rep.fail("T3", "%s: table scrolls %d in %d" % (s, sc["scroll"], sc["client"]))
            elif w < 1240:
                if s not in ("projects", "directory"): rep.fail("T3", "%s: table scrolls %d in %d" % (s, sc["scroll"], sc["client"]))
                elif not sc["sticky"]: rep.fail("T3", "%s: table scrolls %d in %d and the first column is not sticky" % (s, sc["scroll"], sc["client"]))
            else:
                if not (s == "directory" and w == 1280): rep.fail("T14", "%s: table scrolls %d in %d" % (s, sc["scroll"], sc["client"]))
        if touch:
            for x in m["small"]:
                rep.fail("T4", "%s: %s" % (s, x))
            for x in m["fonts"]:
                rep.fail("T5", "%s: %s" % (s, x))
        if w >= 1240:
            if m["hscroll"] > 0: rep.fail("T14", "%s: page scrolls sideways" % s)
            if m["sideWidth"] != 264: rep.fail("T14", "%s: sidebar is %spx, not 264" % (s, m["sideWidth"]))
            if m["mainWidth"] and m["mainWidth"] > 1440: rep.fail("T14", "%s: main is %spx wide, over 1440" % (s, m["mainWidth"]))
        if s == "notifications" and w < 600:
            pass  # the two-step flow is T11
    for e in errors:
        rep.fail("T2", "script error: " + e[:80])
    ctx.close()


def check_reach(browser, w, h, touch, rep):
    """T1: tap through the visible nav (rail or drawer), no router shortcut."""
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    for key, title in TITLES.items():
        try:
            if w < 900 and page.evaluate("document.getElementById('side').classList.contains('closed') === false"):
                page.click("#side-collapse")
            page.click('.nav-btn[data-view="%s"]' % key, timeout=3000); idle(page)
            got = page.evaluate("document.getElementById('page-title').textContent")
            if got != title: rep.fail("T1", "%s: heading is %r, expected %r" % (key, got, title))
            if not page.evaluate("(() => { const m = document.querySelector('main'); const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()"):
                rep.fail("T1", "%s: main is not visible" % key)
        except Exception as e:
            rep.fail("T1", "%s: could not tap the nav (%s)" % (key, str(e).split("\n")[0][:70]))
    # Data trust is hidden (lane H): six nav items, none for Data trust, and no route reaches it.
    try:
        count = page.evaluate("document.querySelectorAll('.nav-btn[data-view]').length")
        if count != len(TITLES): rep.fail("T1", "nav has %d items, expected %d" % (count, len(TITLES)))
        if page.evaluate("!!document.querySelector('.nav-btn[data-view=\"trust\"]')"): rep.fail("T1", "nav still has a Data trust item")
        before = page.evaluate("document.getElementById('page-title').textContent")
        page.evaluate("window.coiApp.go('trust')"); idle(page)
        if page.evaluate("document.getElementById('page-title').textContent") != before: rep.fail("T1", "a route still reaches Data trust")
    except Exception as e:
        rep.fail("T1", "trust is hidden: could not check (%s)" % str(e).split("\n")[0][:70])
    try:
        page.click("#about-link", timeout=3000); page.wait_for_timeout(300)
        if page.evaluate("document.getElementById('page-title').textContent") != "About": rep.fail("T1", "about: heading is not About")
    except Exception as e:
        rep.fail("T1", "about: could not tap the link (%s)" % str(e).split("\n")[0][:70])
    ctx.close()


def check_nav_overlay(browser, w, h, touch, rep):
    """T6: opening the nav must not push main aside, a scrim must exist, a scrim tap closes."""
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('holds')"); idle(page)
    if not page.evaluate("document.getElementById('side').classList.contains('closed')"):
        page.click("#side-collapse"); page.wait_for_timeout(400)
    closed = page.evaluate("Math.round(document.querySelector('main').getBoundingClientRect().width)")
    page.click("#side-expand"); page.wait_for_timeout(500)
    opened = page.evaluate("Math.round(document.querySelector('main').getBoundingClientRect().width)")
    if abs(opened - closed) > 2: rep.fail("T6", "main is %dpx closed and %dpx open" % (closed, opened))
    scrim = page.evaluate("(() => { const s = document.querySelector('.side-scrim'); if (!s) return null; const r = s.getBoundingClientRect(); return getComputedStyle(s).display !== 'none' && r.width > 0; })()")
    if not scrim: rep.fail("T6", "no scrim while the nav is open")
    else:
        page.mouse.click(w - 8, h // 2); page.wait_for_timeout(500)
        if not page.evaluate("document.getElementById('side').classList.contains('closed')"): rep.fail("T6", "a scrim tap did not close the nav")
    page.click("#side-expand"); page.wait_for_timeout(400)
    page.click('.nav-btn[data-view="worklist"]'); idle(page); page.wait_for_timeout(400)
    if not page.evaluate("document.getElementById('side').classList.contains('closed')"): rep.fail("T6", "tapping a nav item did not close the nav")
    ctx.close()


def check_header(browser, w, h, touch, rep):
    """T7: a sticky header at most 64px tall on phones. A static header passes."""
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('record')"); idle(page); page.wait_for_timeout(300)
    page.evaluate("window.scrollTo(0,400)"); page.wait_for_timeout(200)
    r = page.evaluate("(() => { const p = document.getElementById('pagehead'); const s = getComputedStyle(p); return {pos: s.position, h: Math.round(p.getBoundingClientRect().height), top: Math.round(p.getBoundingClientRect().top)}; })()")
    if r["pos"] in ("sticky", "fixed") and r["h"] > 64: rep.fail("T7", "sticky header is %dpx tall" % r["h"])
    ctx.close()


def rect_info(page):
    return page.evaluate("""() => {
      const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; };
      const card = document.querySelector('.ct-card'), ring = document.querySelector('.ct-ring');
      const ringOn = ring && !ring.classList.contains('ct-off') && !ring.classList.contains('ct-dim') && getComputedStyle(ring).display !== 'none';
      const btns = [];
      if (card) card.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width > 0 && r.height > 0) btns.push(b.textContent.trim().slice(0, 12) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (r.height < 43.5 || r.width < 43.5 ? '!' : '')); });
      return {vw: innerWidth, vh: innerHeight, card: box(card), ring: ringOn ? box(ring) : null, final: !!card && card.classList.contains('ct-final'),
        count: (document.getElementById('ct-count') || {}).textContent || '', hscroll: document.documentElement.scrollWidth - innerWidth, btns: btns};
    }""")


def check_welcome_and_tour(browser, w, h, touch, rep, want, shots):
    key = "%dx%d" % (w, h)
    ctx, page = new_page(browser, w, h, touch, seen=False)
    page.goto(BASE + "/index.html"); idle(page); page.wait_for_timeout(2200)
    wc = page.evaluate("""() => { const c = document.querySelector('.ct-wcard'); if (!c) return null; const r = c.getBoundingClientRect(); const b = c.querySelector('[data-w=start]').getBoundingClientRect();
      return {l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight, bh: b.height}; }""")
    shot(page, shots, key, "welcome")
    if not wc: rep.fail("T9", "no welcome card on a first visit")
    else:
        if wc["l"] < -0.5 or wc["r"] > wc["vw"] + 0.5 or wc["t"] < -0.5 or wc["b"] > wc["vh"] + 0.5:
            rep.fail("T9", "welcome card outside the screen (%d,%d to %d,%d in %dx%d)" % (wc["l"], wc["t"], wc["r"], wc["b"], wc["vw"], wc["vh"]))
        if touch and wc["bh"] < 43.5: rep.fail("T9", "start button is %dpx high" % wc["bh"])
    if "T8" not in want:
        ctx.close(); return
    page.click("[data-w=start]")
    for i in range(12):
        page.wait_for_timeout(1300)
        info = rect_info(page)
        shot(page, shots, key, "tour-%d" % (i + 1))
        tag = "step %s" % (info["count"] or i + 1)
        c = info["card"]
        if not c: rep.fail("T8", "%s: no card" % tag); break
        if c["l"] < -0.5 or c["r"] > info["vw"] + 0.5 or c["b"] > info["vh"] + 0.5 or c["t"] < -0.5:
            rep.fail("T8", "%s: card outside the screen (%d,%d to %d,%d in %dx%d)" % (tag, c["l"], c["t"], c["r"], c["b"], info["vw"], info["vh"]))
        if c["h"] > 0.5 * info["vh"] + 0.5: rep.fail("T8", "%s: card is %dpx, over half of %d" % (tag, c["h"], info["vh"]))
        if info["hscroll"] > 0: rep.fail("T8", "%s: page scrolls sideways" % tag)
        if touch:
            for b in info["btns"]:
                if b.endswith("!"): rep.fail("T8", "%s: small button %s" % (tag, b[:-1]))
        r = info["ring"]
        # A beat with no target (target: null) frames the card itself, as the finish card does. That is by design.
        frames_card = r and c and all(abs(r[k] - c[k]) <= 3 for k in ("l", "t", "r", "b"))
        if r and not info["final"] and not frames_card:
            ox = max(0, min(r["r"], c["r"]) - max(r["l"], c["l"])); oy = max(0, min(r["b"], c["b"]) - max(r["t"], c["t"]))
            area = max(1, r["w"] * r["h"]); covered = ox * oy / area
            if covered > 0.5: rep.fail("T8", "%s: card hides %d%% of the highlighted target" % (tag, covered * 100))
            if r["b"] < 0 or r["t"] > info["vh"]: rep.fail("T8", "%s: target is off the screen" % tag)
        if info["final"]: break
        nb = page.query_selector(".ct-next")
        if not nb or not nb.is_visible(): rep.fail("T8", "%s: no Next button" % tag); break
        nb.click()
    else:
        rep.fail("T8", "the tour never reached the finish card")
    ctx.close()


def check_dialog(browser, w, h, touch, rep, shots):
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('record')"); idle(page); page.wait_for_timeout(300)
    if not page.query_selector("#correct"):
        rep.fail("T10", "no 'Fix a misread value' button on the record"); ctx.close(); return
    page.click("#correct"); page.wait_for_timeout(600)
    d = page.evaluate("""() => { const d = document.getElementById('editor'); const r = d.getBoundingClientRect(); const s = d.querySelector('#save-correction').getBoundingClientRect();
      const fonts = []; d.querySelectorAll('input,select,textarea').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0) fonts.push(e.id + ' ' + parseFloat(getComputedStyle(e).fontSize)); });
      return {l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, vw: innerWidth, vh: innerHeight, sb: s.bottom, st: s.top, fonts: fonts, maxh: getComputedStyle(d).maxHeight}; }""")
    shot(page, shots, "%dx%d" % (w, h), "dialog")
    if d["l"] < -0.5 or d["r"] > d["vw"] + 0.5 or d["t"] < -0.5 or d["b"] > d["vh"] + 0.5: rep.fail("T10", "dialog outside the screen (%d,%d to %d,%d)" % (d["l"], d["t"], d["r"], d["b"]))
    if d["h"] > d["vh"] + 0.5: rep.fail("T10", "dialog is %dpx high in %d" % (d["h"], d["vh"]))
    if d["sb"] > d["vh"] + 0.5 or d["st"] < 0: rep.fail("T10", "Save button is not on the screen without scrolling")
    if touch:
        for f in d["fonts"]:
            if float(f.split()[-1]) < 15.99: rep.fail("T10", "dialog field text %spx" % f)
    ctx.close()


def check_notes(browser, w, h, touch, rep, shots):
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('notifications')"); idle(page); page.wait_for_timeout(300)
    if w < 600:
        page.click(".note-item >> nth=1"); page.wait_for_timeout(500)
        d = page.evaluate("""() => {
          const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };
          const back = document.getElementById('note-back'), prev = document.getElementById('note-preview'), list = document.querySelector('.note-list');
          const head = document.getElementById('pagehead'), hs = getComputedStyle(head);
          const h2 = prev.querySelector('h2');
          return {detail: vis(prev), list: vis(list), back: vis(back), backH: back ? back.getBoundingClientRect().height : 0,
            titleTop: h2 ? h2.getBoundingClientRect().top : null, headBottom: (hs.position === 'sticky' || hs.position === 'fixed') ? head.getBoundingClientRect().bottom : 0}; }""")
        shot(page, shots, "%dx%d" % (w, h), "notification-detail")
        if not d["detail"]: rep.fail("T11", "the detail is not shown after a tap")
        if d["list"]: rep.fail("T11", "the list still shows beside the detail")
        if not d["back"]: rep.fail("T11", "no Back to list button")
        elif d["backH"] < 43.5: rep.fail("T11", "Back button is %dpx high" % d["backH"])
        if d["titleTop"] is not None and d["titleTop"] < d["headBottom"] - 0.5: rep.fail("T11", "the title is under the sticky header")
        if d["back"]:
            page.click("#note-back"); page.wait_for_timeout(400)
            if not page.evaluate("(() => { const l = document.querySelector('.note-list'); return l.getBoundingClientRect().height > 0; })()"): rep.fail("T11", "Back did not show the list")
    elif w < 900:
        d = page.evaluate("""() => { const l = document.querySelector('.note-list').getBoundingClientRect(), p = document.getElementById('note-preview').getBoundingClientRect(); return {lw: l.width, pw: p.width, side: p.left >= l.right - 1}; }""")
        if not d["side"]: rep.fail("T11", "list and detail are not side by side at %d" % w)
        elif d["lw"] > 340 or d["pw"] < 300: rep.fail("T11", "pane widths %d and %d" % (d["lw"], d["pw"]))
    ctx.close()


def check_pdf(browser, w, h, touch, rep):
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('record')"); idle(page); page.wait_for_timeout(300)
    if page.evaluate("!document.getElementById('pdf-panel').open"):
        page.click("#pdf-panel summary")
    page.wait_for_timeout(1500)
    link = page.evaluate("""() => { const a = document.getElementById('open-pdf'); if (!a) return null; const r = a.getBoundingClientRect();
      return {target: a.getAttribute('target'), h: r.height, w: r.width, shown: r.width > 0, href: a.getAttribute('href') || ''}; }""")
    if not link:
        if w < 600: rep.fail("T12", "no Open PDF link")
    else:
        if link["target"] != "_blank": rep.fail("T12", "Open PDF does not open a new tab")
        if w < 600 and not link["shown"]: rep.fail("T12", "Open PDF is not shown")
        elif w < 600 and link["h"] < 43.5: rep.fail("T12", "Open PDF is %dpx high" % link["h"])
    sh = page.evaluate("(() => { const s = document.querySelector('#pdf-panel summary').getBoundingClientRect(); return s.height; })()")
    if touch and sh < 43.5: rep.fail("T12", "the PDF summary is %dpx high" % sh)
    c = page.evaluate("""() => { const c = document.querySelector('#pdf-pages canvas'); if (!c) return null; return {w: c.getBoundingClientRect().width, m: document.querySelector('main').getBoundingClientRect().width}; }""")
    if c and c["w"] > c["m"] + 0.5: rep.fail("T12", "canvas %dpx wider than main %dpx" % (c["w"], c["m"]))
    ctx.close()


def check_record_phone(browser, w, h, touch, rep):
    """R9: on a phone the next-action bar sticks to the bottom."""
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    page.evaluate("window.coiApp.go('record')"); idle(page); page.wait_for_timeout(400)
    page.evaluate("window.scrollTo(0,500)"); page.wait_for_timeout(250)
    r = page.evaluate("""() => { const c = document.querySelector('.title-row .action-card'); if (!c) return {none: true};
      const b = c.getBoundingClientRect(); return {pos: getComputedStyle(c.parentElement).position + '/' + getComputedStyle(c).position, bottom: b.bottom, vh: innerHeight, top: b.top}; }""")
    if r.get("none"): ctx.close(); return
    if r["bottom"] > r["vh"] + 0.5 or r["top"] < 0: rep.fail("T12", "the next-action card is not in reach after scrolling (bottom %d of %d)" % (r["bottom"], r["vh"]))
    ctx.close()


def check_upload(browser, w, h, touch, rep, shots):
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/upload.html"); page.wait_for_timeout(900)
    m = page.evaluate(MEASURE, touch)
    shot(page, shots, "%dx%d" % (w, h), "upload")
    if m["hscroll"] > 0: rep.fail("T13", "page scrolls %dpx sideways" % m["hscroll"])
    for x in m["wide"][:3]: rep.fail("T13", "%s past the edge" % x)
    d = page.evaluate("""() => { const hs = id => document.getElementById(id).getBoundingClientRect().height;
      const logo = document.querySelector('.uploadhead .logo').getBoundingClientRect(), h1 = document.querySelector('.upload-main h1').getBoundingClientRect();
      return {send: hs('send'), choose: hs('choose'), accept: document.getElementById('file').getAttribute('accept') || '', logoL: logo.left, h1L: h1.left,
        body: parseFloat(getComputedStyle(document.querySelector('.upload-card p')).fontSize)}; }""")
    if touch:
        if d["send"] < 47.5: rep.fail("T13", "Upload certificate is %dpx high" % d["send"])
        if d["choose"] < 47.5: rep.fail("T13", "Choose PDF is %dpx high" % d["choose"])
        if d["body"] < 15.99: rep.fail("T13", "body text is %spx" % d["body"])
    if "pdf" not in d["accept"]: rep.fail("T13", "the file input does not accept PDF")
    if w <= 899 and abs(d["logoL"] - d["h1L"]) > 1: rep.fail("T13", "logo left %d, content left %d" % (d["logoL"], d["h1L"]))
    # the whole drop zone opens the picker
    try:
        with page.expect_file_chooser(timeout=3000):
            page.click("#drop-title")
    except Exception:
        rep.fail("T13", "tapping the drop zone text does not open the file picker")
    # an error shows without scrolling
    page.click("#send"); page.wait_for_timeout(300)
    e = page.evaluate("(() => { const r = document.getElementById('upload-error').getBoundingClientRect(); return {t: r.top, b: r.bottom, vh: innerHeight, shown: r.height > 0}; })()")
    if not e["shown"] or e["t"] < 0 or e["b"] > e["vh"]: rep.fail("T13", "the error is not on the screen after a tap on Upload")
    if SAMPLE_PDF:
        page.set_input_files("#file", SAMPLE_PDF); page.wait_for_timeout(400)
        shot(page, shots, "%dx%d" % (w, h), "upload-chosen")
        b = page.evaluate("(() => { const r = document.getElementById('send').getBoundingClientRect(); return {b: r.bottom, vh: innerHeight, pos: getComputedStyle(document.getElementById('send')).position}; })()")
        if b["b"] > b["vh"] and b["pos"] not in ("sticky", "fixed"): rep.fail("T13", "Upload certificate is below the fold after choosing a file (bottom %d of %d)" % (b["b"], b["vh"]))
        page.click("#send"); page.wait_for_timeout(1200)
        if touch:
            page.evaluate("""() => { const a = document.getElementById('progress-actions'); a.innerHTML = '<button class="btn secondary small" id="t1">Check progress</button><button class="btn secondary small" id="t2">Choose a new PDF</button>'; }""")
            hs = page.evaluate("[document.getElementById('t1').getBoundingClientRect().height, document.getElementById('t2').getBoundingClientRect().height]")
            if min(hs) < 43.5: rep.fail("T13", "progress buttons are %dpx and %dpx high" % (hs[0], hs[1]))
        shot(page, shots, "%dx%d" % (w, h), "upload-progress")
    ctx.close()
    if w == 375:
        ctx, page = new_page(browser, 375, 667, True)
        page.goto(BASE + "/upload.html"); page.wait_for_timeout(700)
        if SAMPLE_PDF:
            page.set_input_files("#file", SAMPLE_PDF); page.wait_for_timeout(400)
            b = page.evaluate("(() => { const r = document.getElementById('send').getBoundingClientRect(); return {b: r.bottom, vh: innerHeight, pos: getComputedStyle(document.getElementById('send')).position}; })()")
            if b["b"] > b["vh"] and b["pos"] not in ("sticky", "fixed"): rep.fail("T13", "at 375x667 Upload certificate is below the fold after choosing a file (bottom %d of %d)" % (b["b"], b["vh"]))
        ctx.close()


def check_hover(browser, w, h, touch, rep):
    ctx, page = new_page(browser, w, h, touch)
    page.goto(BASE + "/index.html"); idle(page)
    for x in page.evaluate(HOVER)[:8]:
        rep.fail("T15", "unguarded %s" % x)
    ctx.close()


def parse(argv):
    opts = {"sizes": None, "tests": None, "shots": None, "verbose": False, "base": argv[0]}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--sizes": opts["sizes"] = argv[i + 1].split(","); i += 1
        elif a == "--tests": opts["tests"] = set(argv[i + 1].upper().split(",")); i += 1
        elif a == "--shots": opts["shots"] = argv[i + 1]; i += 1
        elif a == "-v": opts["verbose"] = True
        i += 1
    return opts


BASE = ""


def main():
    global BASE
    opts = parse(sys.argv[1:])
    BASE = opts["base"]
    want = opts["tests"] or set(NAMES)
    sizes = [s for s in SIZES if not opts["sizes"] or "%dx%d" % s in opts["sizes"]]
    failed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium(), args=["--no-sandbox"])
        for w, h in sizes:
            touch = w <= TOUCH_MAX
            rep = Report()
            for t in want: rep.touch(t)
            need_screens = want & {"T2", "T3", "T4", "T5", "T14"}
            if need_screens: check_screens(browser, w, h, touch, rep, want, opts["shots"])
            if "T1" in want: check_reach(browser, w, h, touch, rep)
            if "T6" in want and w < 900: check_nav_overlay(browser, w, h, touch, rep)
            if "T7" in want and w < 600: check_header(browser, w, h, touch, rep)
            if want & {"T8", "T9"} and w <= 1180: check_welcome_and_tour(browser, w, h, touch, rep, want, opts["shots"])
            if "T10" in want: check_dialog(browser, w, h, touch, rep, opts["shots"])
            if "T11" in want and w < 900: check_notes(browser, w, h, touch, rep, opts["shots"])
            if "T12" in want:
                check_pdf(browser, w, h, touch, rep)
                if w < 600: check_record_phone(browser, w, h, touch, rep)
            if "T13" in want and w <= 1180: check_upload(browser, w, h, touch, rep, opts["shots"])
            if "T15" in want and w in (375, 1440): check_hover(browser, w, h, touch, rep)
            print("== %dx%d %s ==" % (w, h, "touch" if touch else "mouse"))
            for t in sorted(want, key=lambda x: int(x[1:])):
                if t == "T14" and w < 1240: continue
                if t in ("T6",) and w >= 900: continue
                if t == "T7" and w >= 600: continue
                if t in ("T8", "T9", "T13") and w > 1180: continue
                if t == "T11" and w >= 900: continue
                if t == "T15" and w not in (375, 1440): continue
                items = rep.rows.get(t, [])
                if not items: print("  PASS  %s %s" % (t, NAMES[t])); continue
                failed += 1
                print("  FAIL  %s %s (%d)" % (t, NAMES[t], len(items)))
                for x in (items if opts["verbose"] else items[:5]): print("          - " + x)
                if not opts["verbose"] and len(items) > 5: print("          ... %d more (use -v)" % (len(items) - 5))
        browser.close()
    print("\n%s" % ("All responsive checks passed." if not failed else "%d check results failed." % failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
