"""Scrape current and finished AMKRO events plus their standings into data/standings.json.

Runs in GitHub Actions (see .github/workflows/update-standings.yml).
Credentials come from the environment (GitHub Secrets): WSS_EMAIL, WSS_PASSWORD

The standings page layout is not known in advance, so every <table> on the page is
saved as rows of text; if a page has no table, its visible text is saved instead.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ORG = "https://paddock.worldsimseries.com/organizations/2b746de0d67e2930b18aacfa19e07eeb"
BASE = "https://paddock.worldsimseries.com"
LISTS = [("current", ORG + "#/events"), ("finished", ORG + "#/finished-events")]
OUT = Path(__file__).resolve().parent.parent / "data" / "standings.json"
MAX_FINISHED = 60
IGNORED = ["YOU ARE REGISTERED", "YOU ARE INVITED", "UPCOMING", "ONGOING", "FINISHED",
           "REGISTERED", "INVITED", "STARTING IN", "OUR PARTNERS", "SIGN IN", "CREATE TEAM"]
ID_RE = re.compile(r"/events/(\d+)")

TABLES_JS = """() => [...document.querySelectorAll('table')].map(t => {
  let title = '';
  let n = t;
  for (let i = 0; i < 6 && n && !title; i++) {
    let p = n.previousElementSibling;
    while (p && !title) {
      const h = p.matches('h1,h2,h3,h4,h5') ? p : p.querySelector('h1,h2,h3,h4,h5');
      if (h) title = h.innerText.trim();
      p = p.previousElementSibling;
    }
    n = n.parentElement;
  }
  const rows = [...t.querySelectorAll('tr')]
    .map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.replace(/\\s+/g, ' ').trim()))
    .filter(r => r.some(c => c));
  return {title, rows: rows.slice(0, 80)};
}).filter(t => t.rows.length)"""


def login(page, email, password):
    if "SIGN IN" in page.inner_text("body").upper() and email and password:
        page.fill("input[type='email'], input[name='email']", email)
        page.fill("input[type='password'], input[name='password']", password)
        page.click("button:has-text('SIGN IN'), button[type='submit']")
        page.wait_for_timeout(5000)


def collect_cards(page, status):
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(3000)
    found = {}
    for a in page.query_selector_all("a[href*='/events/']"):
        try:
            href = a.get_attribute("href") or ""
            m = ID_RE.search(href)
            if not m:
                continue
            eid = m.group(1)
            text = a.inner_text().strip()
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            title = next((l for l in lines if len(l) > 3 and not any(i in l.upper() for i in IGNORED)), None)
            if not title:
                continue
            img = a.query_selector("img")
            thumb = img.get_attribute("src") if img else ""
            if thumb and thumb.startswith("/"):
                thumb = "https://worldsimseries.com" + thumb
            when = re.search(r"\d{1,2}(?:ST|ND|RD|TH)?\s+[A-Za-z]{3}(?:\s+\d{4})?\s+\d{1,2}:\d{2}", text)
            found.setdefault(eid, {
                "id": eid, "name": title, "status": status, "date": when.group(0) if when else "",
                "thumbnail": thumb or "", "url": f"{BASE}/events/{eid}",
                "standingsUrl": f"{BASE}/events/{eid}/standings#/",
            })
        except Exception:
            continue
    return found


def scrape_standings(page, ev):
    try:
        page.goto(ev["standingsUrl"], wait_until="domcontentloaded")
        page.wait_for_timeout(4500)
        tables = page.evaluate(TABLES_JS)
        ev["tables"] = tables
        ev["text"] = "" if tables else page.inner_text("body").strip()[:3000]
    except Exception as e:
        print(f"Standings failed for {ev['id']}: {e}", file=sys.stderr)
        ev.setdefault("tables", [])
        ev.setdefault("text", "")


def main():
    email, password = os.environ.get("WSS_EMAIL"), os.environ.get("WSS_PASSWORD")
    events = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                                  timezone_id="Europe/Berlin")
        page = ctx.new_page()
        page.goto(LISTS[0][1], wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        login(page, email, password)

        for status, url in LISTS:
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            for eid, ev in collect_cards(page, status).items():
                if eid in events and status == "finished":
                    events[eid]["status"] = "finished"
                else:
                    events.setdefault(eid, ev)

        ordered = sorted(events.values(), key=lambda e: int(e["id"]), reverse=True)
        finished = [e for e in ordered if e["status"] == "finished"][:MAX_FINISHED]
        keep = [e for e in ordered if e["status"] != "finished"] + finished
        for ev in keep:
            scrape_standings(page, ev)
        browser.close()

    if not keep:
        print("No events found; keeping the existing data/standings.json.", file=sys.stderr)
        sys.exit(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(), "events": keep},
                              indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(keep)} events.")


if __name__ == "__main__":
    main()
