"""Scrape the AMKRO Paddock events page and write data/events.json.

Runs in GitHub Actions (see .github/workflows/update-data.yml).
Credentials come from the environment (GitHub Secrets), never from this file:
    WSS_EMAIL, WSS_PASSWORD
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

PADDOCK_URL = "https://paddock.worldsimseries.com/organizations/2b746de0d67e2930b18aacfa19e07eeb#/events"
TZ = ZoneInfo("Europe/Berlin")
OUT = Path(__file__).resolve().parent.parent / "data" / "events.json"
DEFAULT_DURATION_HOURS = 2

IGNORED = ["YOU ARE REGISTERED", "YOU ARE INVITED", "UPCOMING", "ONGOING", "FINISHED",
           "REGISTERED", "INVITED", "STARTING IN", "OUR PARTNERS", "SIGN IN", "CREATE TEAM"]
MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}
DATE_RE = re.compile(r"(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Z]{3})\s+(\d{1,2}):(\d{2})")


def parse_start(text):
    m = DATE_RE.search(text.upper())
    if not m or m.group(2) not in MONTHS:
        return None
    day, mon, hour, minute = int(m.group(1)), MONTHS[m.group(2)], int(m.group(3)), int(m.group(4))
    now = datetime.now(TZ)
    try:
        start = datetime(now.year, mon, day, hour, minute, tzinfo=TZ)
    except ValueError:
        return None
    # The card has no year: pick the year that puts the date closest to today.
    if start < now - timedelta(days=183):
        start = start.replace(year=now.year + 1)
    elif start > now + timedelta(days=183):
        start = start.replace(year=now.year - 1)
    return start.isoformat()


def fetch_events():
    email, password = os.environ.get("WSS_EMAIL"), os.environ.get("WSS_PASSWORD")
    found = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                                  timezone_id="Europe/Berlin")
        page = ctx.new_page()
        page.goto(PADDOCK_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        if "SIGN IN" in page.inner_text("body").upper() and email and password:
            page.fill("input[type='email'], input[name='email']", email)
            page.fill("input[type='password'], input[name='password']", password)
            page.click("button:has-text('SIGN IN'), button[type='submit']")
            page.wait_for_timeout(5000)
            page.goto(PADDOCK_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(3000)

        for card in page.query_selector_all("a[href*='events']"):
            try:
                href = card.get_attribute("href") or ""
                low = href.lower()
                if not href or any(b in low for b in ("calendar", "partner", "privacy", "terms")):
                    continue
                if href.startswith("http"):
                    url = href
                elif href.startswith("/"):
                    url = "https://paddock.worldsimseries.com" + href
                else:
                    url = "https://paddock.worldsimseries.com/" + href
                if "/events/" not in url:
                    continue

                text = card.inner_text().strip()
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                title = next((l for l in lines
                              if len(l) > 3 and not any(i in l.upper() for i in IGNORED)), None)
                start = parse_start(text)
                if not title or not start:
                    continue

                img = card.query_selector("img")
                thumb = img.get_attribute("src") if img else ""
                if thumb and thumb.startswith("/"):
                    thumb = "https://worldsimseries.com" + thumb

                found.setdefault(url, {
                    "name": title, "start": start, "durationHours": DEFAULT_DURATION_HOURS,
                    "thumbnail": thumb or "", "url": url, "description": "",
                })
            except Exception:
                continue
        browser.close()
    return sorted(found.values(), key=lambda e: e["start"])


def main():
    events = fetch_events()
    if not events:
        print("No events found; keeping the existing data/events.json.", file=sys.stderr)
        sys.exit(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"events": events}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(events)} events.")


if __name__ == "__main__":
    main()
