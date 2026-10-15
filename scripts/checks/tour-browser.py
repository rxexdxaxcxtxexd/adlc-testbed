"""Check the local tour at the handoff's phone and desktop sizes.

Run this check after section 6 steps 1 and 2 pass.
Use a localhost URL and an output directory inside this repository.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from playwright.sync_api import expect, sync_playwright


REPO = Path(__file__).resolve().parents[2]
SIZES = ((375, 667), (1440, 900))
# These literals came from TourSteps.html and handoff section 4.
# Do not read expected copy from the page or its configuration.
STEPS = (
    ("No payment without valid coverage",
     "Every certificate, on every project, tracked. Payment waits until it’s right."),
    ("Only what needs you reaches you",
     "Certificates check themselves. Only what needs you lands here."),
    ("AI reads. Code decides. You approve.",
     "Under 85% confidence, a person checks it first. The model never does arithmetic."),
    ("Payments wait until coverage is right",
     "Holds set and lift on their own. Every dollar and reason in view."),
    ("Every subcontractor in one place",
     "Contacts, status, certificates and messages, together."),
    ("Every message, on the record",
     "Every message logged, with how it was approved: by a person or by a rule."),
    ("How AI is used",
     "AI reads the certificate. Code checks every limit and date. AI writes the wording of the notices. Code writes every number. A person approves."),
    ("Your morning, in two moves",
     "Clear your Worklist. Check holds before the pay run. That’s it."),
)
FINAL_TITLE = "You’re all set"
FINAL_BODY = "Replay anytime from Tour."


STABLE_CARD = r"""({selector, title, timeout}) => new Promise((resolve, reject) => {
  const start = performance.now();
  let previous = null, stableSince = null;
  function sample(now) {
    const card = document.querySelector('.ct-card');
    const heading = document.querySelector(selector);
    const view = document.getElementById('view');
    if (now - start > timeout) {
      reject(new Error('The visible card did not settle for ' + title));
      return;
    }
    if (!card || !heading || heading.textContent !== title ||
        !view || view.getAttribute('aria-busy') !== 'false') {
      stableSince = null; requestAnimationFrame(sample); return;
    }
    const css = getComputedStyle(card), r = card.getBoundingClientRect();
    const hs = getComputedStyle(heading), hr = heading.getBoundingClientRect();
    if (card.classList.contains('ct-off') || card.classList.contains('ct-out') ||
        css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) < .99 ||
        r.width <= 0 || r.height <= 0 || hs.display === 'none' || hr.height <= 0) {
      stableSince = null; requestAnimationFrame(sample); return;
    }
    const current = [r.left, r.top, r.right, r.bottom, window.scrollX, window.scrollY];
    if (!previous || current.some((value, i) => Math.abs(value - previous[i]) > .5)) {
      stableSince = now;
    } else if (stableSince === null) {
      stableSince = now;
    }
    previous = current;
    if (now - stableSince >= 350) { resolve(true); return; }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
})"""


MEASURE_CARD = r"""(final) => {
  const rect = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
  };
  const card = document.querySelector('.ct-card');
  const heading = card.querySelector(final ? '#ct-fin-title' : '#ct-title');
  const body = card.querySelector(final ? '.ct-fin .ct-body' : '#ct-body');
  const ring = document.querySelector('.ct-ring');
  const ringShown = ring && !ring.classList.contains('ct-off') &&
    !ring.classList.contains('ct-dim') && getComputedStyle(ring).display !== 'none' &&
    Number(getComputedStyle(ring).opacity) >= .99;
  return {
    viewport:{width:innerWidth, height:innerHeight},
    card:rect(card), heading:rect(heading), body:rect(body),
    title:heading.innerText, text:body.innerText, ring:ringShown ? rect(ring) : null,
    final:card.classList.contains('ct-final'), docked:card.classList.contains('ct-docked'),
    count:card.querySelector('#ct-count').textContent,
    autoplay:card.querySelector('[data-ct="play"]').getAttribute('aria-pressed'),
    position:getComputedStyle(card).position,
    cardScroll:{top:card.scrollTop, height:card.scrollHeight, clientHeight:card.clientHeight}
  };
}"""


def repo_path(path):
    """Reject paths that resolve outside the repository."""
    resolved = Path(path).resolve()
    try:
        resolved.relative_to(REPO)
    except ValueError as error:
        raise ValueError("The output path must stay inside coi-poc.") from error
    return resolved


def tour_url(base):
    """Accept only a localhost URL without credentials, query, or fragment."""
    parsed = urlsplit(base)
    if (parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1", "::1")
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("Use a plain HTTP localhost base URL.")
    path = parsed.path.rstrip("/")
    if not path.endswith(".html"):
        path += "/index.html"
    return urlunsplit((parsed.scheme, parsed.netloc, path, "tour=play", ""))


def inside(rect, viewport):
    return (rect and rect["width"] > 0 and rect["height"] > 0
            and rect["left"] >= -0.5 and rect["top"] >= -0.5
            and rect["right"] <= viewport["width"] + 0.5
            and rect["bottom"] <= viewport["height"] + 0.5)


def check_measurement(info, width, height, title, body, final):
    if info["title"] != title or info["text"] != body:
        raise AssertionError("The visible title or body differs from the literal expected copy.")
    if info["viewport"] != {"width": width, "height": height}:
        raise AssertionError("The browser viewport differs from the requested size.")
    if not inside(info["card"], info["viewport"]):
        raise AssertionError("The tour card extends outside the viewport.")
    if not inside(info["heading"], info["viewport"]) or not inside(info["body"], info["viewport"]):
        raise AssertionError("The tour title or body extends outside the viewport.")
    if info["position"] != "fixed" or info["final"] != final:
        raise AssertionError("The card has an unexpected position or final-card state.")
    if not final and info["autoplay"] != "false":
        raise AssertionError("Autoplay resumed after the visible Pause control was used.")


def capture_card(page, output, cards, width, height, number, title, body, final=False):
    selector = "#ct-fin-title" if final else "#ct-title"
    page.evaluate(STABLE_CARD, {"selector": selector, "title": title, "timeout": 15000})
    info = page.evaluate(MEASURE_CARD, final)
    # Retain evidence before an assertion stops this viewport's tour.
    screenshot = repo_path(output / ("%dx%d-%02d.png" % (width, height, number)))
    page.screenshot(path=str(screenshot), full_page=False, animations="allow", timeout=10000)
    info["screenshot"] = str(screenshot.relative_to(REPO))
    cards.append(info)
    check_measurement(info, width, height, title, body, final)
    # Sample the card again after the screenshot to catch late movement.
    later = page.evaluate(MEASURE_CARD, final)
    check_measurement(later, width, height, title, body, final)
    info["afterScreenshot"] = later["card"]
    return info


def check_size(browser, url, output, width, height, action_timeout, navigation_timeout):
    report = {"size": "%dx%d" % (width, height), "cards": [], "pageErrors": [],
              "consoleErrors": [], "failures": [], "passed": False}
    context = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=1, is_mobile=width == 375,
                                  has_touch=width == 375, reduced_motion="no-preference")
    page = context.new_page()
    page.set_default_timeout(action_timeout)
    page.set_default_navigation_timeout(navigation_timeout)
    page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
    page.on("console", lambda message: report["consoleErrors"].append(
        {"text": message.text, "location": message.location}) if message.type == "error" else None)
    try:
        response = page.goto(url, wait_until="domcontentloaded")
        if not response or response.status != 200:
            raise AssertionError("The local preview did not return HTTP 200.")
        page.wait_for_function("""() => {
          const view = document.getElementById('view');
          return window.coiApp && window.CoiTour && view &&
            view.getAttribute('aria-busy') === 'false';
        }""", timeout=15000)
        pause = page.locator('.ct-card').get_by_role("button", name="Pause", exact=True)
        expect(pause).to_be_visible(timeout=15000)
        expect(pause).to_have_attribute("aria-pressed", "true")
        pause.click()
        play = page.locator('.ct-card [data-ct="play"]')
        expect(play).to_have_text("Autoplay")
        expect(play).to_have_attribute("aria-pressed", "false")
        report["pausedThroughVisibleControl"] = True
        for index, (title, body) in enumerate(STEPS):
            info = capture_card(page, output, report["cards"], width, height, index + 1, title, body)
            if info["count"] != "%d of 8" % (index + 1):
                raise AssertionError("The visible step counter differs from its literal expected value.")
            if index == 6:
                if (info["body"]["top"] < info["card"]["top"] - .5
                        or info["body"]["bottom"] > info["card"]["bottom"] + .5):
                    raise AssertionError("The AI wording is clipped inside its card.")
                # The AI beat has no target and frames the card itself.
                if not info["ring"] or any(abs(info["ring"][key] - info["card"][key]) > 3
                                           for key in ("left", "top", "right", "bottom")):
                    raise AssertionError("The AI beat does not visibly frame its own card.")
                if width == 1440:
                    card = info["card"]
                    if (abs((card["left"] + card["right"]) / 2 - 720) > 2
                            or abs((card["top"] + card["bottom"]) / 2 - 450) > 2):
                        raise AssertionError("The desktop AI beat is not centred.")
                elif not info["docked"]:
                    raise AssertionError("The phone AI beat is not docked on screen.")
                report["aiBeatLiteralCopyAndAppearancePassed"] = True
            # The Next control says Finish on the eighth beat.
            label = "Finish" if index == 7 else "Next"
            page.locator('.ct-card').get_by_role("button", name=label, exact=True).click()
        capture_card(page, output, report["cards"], width, height, 9,
                     FINAL_TITLE, FINAL_BODY, final=True)
        page.wait_for_function("() => window.CoiTour && !window.CoiTour.isOpen()", timeout=8000)
        page.wait_for_timeout(300)
        if report["pageErrors"] or report["consoleErrors"]:
            raise AssertionError("The browser reported a page error or console error.")
        report["passed"] = True
    except Exception as error:
        report["failures"].append(str(error))
        if not page.is_closed():
            failure_shot = repo_path(output / ("%dx%d-failure.png" % (width, height)))
            try:
                page.screenshot(path=str(failure_shot), full_page=False, timeout=10000)
                report["failureScreenshot"] = str(failure_shot.relative_to(REPO))
            except Exception as screenshot_error:
                report["failures"].append("Failure screenshot: " + str(screenshot_error))
    finally:
        context.close()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="Localhost base URL or localhost index.html URL")
    parser.add_argument("--output", required=True, help="Output directory inside coi-poc")
    parser.add_argument("--action-timeout", type=int, default=8000, help="Action timeout in milliseconds")
    parser.add_argument("--navigation-timeout", type=int, default=45000, help="Navigation timeout in milliseconds")
    args = parser.parse_args()
    try:
        url = tour_url(args.base)
        output = repo_path(args.output)
        if args.action_timeout <= 0 or args.navigation_timeout <= 0:
            raise ValueError("Timeouts must be positive.")
    except ValueError as error:
        parser.error(str(error))
    output.mkdir(parents=True, exist_ok=True)
    result = {"startedAt": datetime.now(timezone.utc).isoformat(), "url": url,
              "browser": "Playwright Chromium", "results": [], "passed": False}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                for width, height in SIZES:
                    report = check_size(browser, url, output, width, height,
                                        args.action_timeout, args.navigation_timeout)
                    result["results"].append(report)
                    print(("PASS " if report["passed"] else "FAIL ") + report["size"])
                    if not report["passed"]:
                        break
            finally:
                browser.close()
        result["passed"] = len(result["results"]) == 2 and all(row["passed"] for row in result["results"])
    except Exception as error:
        result["failure"] = str(error)
    result["finishedAt"] = datetime.now(timezone.utc).isoformat()
    report_file = repo_path(output / "tour-browser.json")
    report_file.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Tour browser checks passed." if result["passed"] else "Tour browser checks failed.")
    print("Report: " + str(report_file.relative_to(REPO)))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
