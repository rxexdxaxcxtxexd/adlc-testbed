"""Render and check the four direction studies through a real browser."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageOps, ImageDraw
ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
DIRECTIONS = ["vault", "ledger", "signal", "drafting"]
COLORS = ["green", "amber", "red", "blue", "violet", "neutral"]

def rgb(color):
    color = color.strip()
    if color.startswith("#"):
        return [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
    return [float(x)/255 for x in re.findall(r"[\d.]+", color)[:3]]

def luminance(color):
    vals = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb(color)]
    return sum(v*w for v, w in zip(vals, [.2126, .7152, .0722]))

def contrast(a, b):
    hi, lo = sorted([luminance(a), luminance(b)], reverse=True)
    return (hi+.05)/(lo+.05)

results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=r"C:\Users\layden\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe")
    for name in DIRECTIONS:
        context = browser.new_context(viewport={"width":1440,"height":1100},device_scale_factor=1, reduced_motion="reduce")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto((ROOT/f"{name}.html").as_uri(), wait_until="load", timeout=45000)
        page.wait_for_function("document.documentElement.dataset.ready === 'true'")
        page.wait_for_function("document.querySelector('.pdf-pages').dataset.rendered",timeout=25000)
        assert page.locator(".pdf-pages").get_attribute("data-rendered") == "true", name + ": PDF not rendered"
        page.evaluate("document.fonts.ready")
        info = page.evaluate("""() => {
          const css=getComputedStyle(document.documentElement);
          const names=['canvas','surface','chrome','ink','muted','edge','field-bg','primary','on-primary','primary-hover',
            'green','green-tint','amber','amber-tint','red','red-tint','blue','blue-tint','violet','violet-tint','neutral','neutral-tint'];
          const tokens=Object.fromEntries(names.map(n=>[n,css.getPropertyValue('--'+n).trim()]));
          return {tokens,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),width:document.documentElement.scrollWidth,
            headings:[...document.querySelectorAll('h1,h2')].map(e=>({text:e.textContent,size:getComputedStyle(e).fontSize})),
            grid:getComputedStyle(document.querySelector('.layout')).gridTemplateAreas};
        }""")
        assert info["width"] <= 1440, name + ": horizontal overflow"
        tokens = info["tokens"]
        status_ratios = {}
        for tone in COLORS:
            surface_ratio = contrast(tokens[tone], tokens["surface"])
            canvas_ratio = contrast(tokens[tone], tokens["canvas"])
            tint_ratio = contrast(tokens[tone], tokens[tone+"-tint"])
            status_ratios[tone] = {"fg":tokens[tone],"tint":tokens[tone+"-tint"],"surface":round(surface_ratio,2),"canvas":round(canvas_ratio,2),"tint_ratio":round(tint_ratio,2),"solid":round(surface_ratio,2)}
            assert min(surface_ratio, canvas_ratio, tint_ratio) >= 4.5, f"{name}: {tone} fails AA"
        body_ratios = {fg:{bg:round(contrast(tokens[fg], tokens[bg]),2) for bg in ["canvas","surface","chrome"]} for fg in ["ink","muted"]}
        assert all(v>=4.5 for row in body_ratios.values() for v in row.values()),name + ": body contrast fails"
        assert contrast(tokens["edge"],tokens["field-bg"])>=3,name + ": control border fails"
        assert contrast(tokens["primary"],tokens["on-primary"])>=4.5,name + ": primary text fails"
        assert page.locator(".status").count()==1
        assert page.locator(".deficiencies li").count()==2
        assert "Not on hold. No bill this pay cycle." in page.locator(".facts").inner_text()
        assert "Policy period" not in page.locator(".record-head").inner_text()
        assert "Certificates · Project requirements" in page.locator(".values .trust").inner_text()
        decisions = page.locator(".button.decision").evaluate_all("""els => els.map(e=>{const c=getComputedStyle(e);return [c.backgroundColor,c.color,c.borderColor,c.fontWeight,c.height]})""")
        assert decisions[0]==decisions[1],name + ": Waive/Reject unequal"
        page.evaluate("document.querySelector('.toasts').replaceChildren()")
        page.screenshot(path=str(SHOTS/f"{name}-1440.png"), full_page=True)
        page.locator("[data-action='waive']").click()
        assert page.locator("#form-error").is_visible()
        assert page.locator(".status").inner_text()=="In review"
        page.locator("#decision-note").fill("Owner accepted the shortfall in writing.")
        page.locator("[data-action='waive']").click()
        page.wait_for_function("document.querySelector('.status').textContent==='Compliant'")
        assert "Nothing waiting" in page.locator(".head-state").inner_text()
        assert "Owner accepted the shortfall in writing." in page.locator(".timeline").inner_text()
        page.locator("[data-action='reset']").click()
        page.locator("#role").select_option("accountant")
        assert "Only the project manager or leadership can waive a deficiency." in page.locator(".step").inner_text()
        page.locator("#record").select_option("brightway")
        page.wait_for_function("document.querySelector('.pdf-pages').dataset.rendered === 'true'")
        assert page.locator(".record-id").inner_text()=="REC-014"
        assert "1,000,000" in page.locator(".pdf-text").inner_text()
        page.locator("[data-action='edit']").click()
        page.locator("[data-edit='glOcc']").fill("1000000")
        page.locator("[data-action='save']").click()
        assert "A correction needs a short note." in page.locator(".toasts").inner_text()
        assert page.locator("[data-edit='glOcc']").input_value()=="1000000"
        page.locator("#correction-note").fill("General liability was misread. The PDF shows $1,000,000.")
        page.locator("[data-action='save']").click()
        page.wait_for_function("document.querySelector('[data-action=\"approve\"]') !== null")
        assert "from $2,000,000 to $1,000,000" in page.locator(".timeline").inner_text()
        page.locator("[data-action='approve']").click()
        page.wait_for_function("document.querySelector('.status').textContent==='Compliant'")
        assert "Dana Reyes (Accountant)" in page.locator(".timeline").inner_text()
        page.locator("[data-action='reset']").click()
        page.locator("[data-action='edit']").click()
        page.keyboard.press("Escape")
        assert page.locator("[data-action='approve']").count()==1
        page.locator("#record").select_option("ridgeline")
        page.wait_for_function("document.querySelector('.pdf-pages').dataset.rendered === 'true'")
        page.locator("details summary").click()
        email=page.locator(".email").inner_text()
        assert "Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC" in email
        assert "Umbrella: $1,000,000 shown, $2,000,000 required" in email
        page.locator("[data-action='reject']").click()
        page.wait_for_function("document.querySelector('.status').textContent==='Awaiting certificate'")
        assert "Nothing waiting" in page.locator(".head-state").inner_text()
        page.locator("[data-action='reset']").click()
        page.wait_for_function("document.querySelector('.pdf-pages').dataset.rendered === 'true'")
        page.set_viewport_size({"width":375,"height":900})
        page.evaluate("document.fonts.ready")
        assert page.evaluate("document.documentElement.scrollWidth")<=375,name + ": mobile overflow"
        mobile = page.evaluate("""() => ({
          topStep:document.querySelector('.step').getBoundingClientRect().top,
          topPdf:document.querySelector('.pdf').getBoundingClientRect().top,
          pdfDisplay:getComputedStyle(document.querySelector('.pdf-pages')).display,
          navCount:document.querySelectorAll('.navigation a').length,
          navVisible:[...document.querySelectorAll('.navigation a')].every(e=>e.getBoundingClientRect().width>0),
          animation:getComputedStyle(document.querySelector('.step')).animationName
        })""")
        assert mobile["topStep"] < mobile["topPdf"]
        assert mobile["pdfDisplay"]=="none"
        assert mobile["navVisible"] and mobile["navCount"]==5
        assert mobile["animation"]=="none"
        page.evaluate("document.querySelector('.toasts').replaceChildren()")
        page.screenshot(path=str(SHOTS/f"{name}-375.png"), full_page=True)
        page.locator("[data-action='pdf']").click()
        assert page.locator(".pdf-pages").is_visible()
        page.locator("[data-action='pdf']").click()
        page.locator("#record").select_option("brightway")
        page.wait_for_function("document.querySelector('.pdf-pages').dataset.rendered === 'true'")
        page.set_viewport_size({"width":1440,"height":1100})
        page.evaluate("document.querySelector('.toasts').replaceChildren()")
        page.screenshot(path=str(SHOTS/f"{name}-brightway-1440.png"),full_page=True)
        assert not errors, f"{name}: JavaScript errors {errors}"
        results[name]={"status_contrast":status_ratios,"body_contrast":body_ratios,"fonts_loaded":info["fonts"],"layout":info["grid"],"mobile":mobile,"errors":errors,"checks":"passed"}
        print(name + ": screenshots, contrast, mobile layout, role refusals, waiver, rejection, correction note, approval, Escape passed.",flush=True)
        context.close()
    browser.close()
(ROOT/"review-results-r2.json").write_text(json.dumps(results,indent=2),encoding="utf-8")
# The board shows equal-sized crops. Full-page images remain separate.
board=Image.new("RGB",(1480,1140),"#dce1dd")
draw=ImageDraw.Draw(board)
for i,name in enumerate(DIRECTIONS):
    shot=Image.open(SHOTS/f"{name}-1440.png").convert("RGB")
    crop=shot.crop((0,0,1440,min(1000,shot.height)))
    crop=ImageOps.fit(crop,(704,490),centering=(.5,0))
    x=24+(i%2)*732
    y=48+(i//2)*552
    board.paste(crop,(x,y))
    draw.text((x,y-24),name.upper(),fill="#20322a")
board.save(SHOTS/"comparison-r2.png")
print("Review evidence saved.",flush=True)
