#!/usr/bin/env python3
"""Log into World Sim Series, read Finished Series from /series-manager#/, open each series' last round standings, and save Top 3 podiums."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://paddock.worldsimseries.com/login"
SERIES_MANAGER_URL = "https://paddock.worldsimseries.com/series-manager#/"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "standings.json"

ALPHA3_TO_2 = {
    "LVA": "LV", "LTU": "LT", "EST": "EE", "DEU": "DE", "GER": "DE",
    "GBR": "GB", "ENG": "GB", "SCO": "GB", "WAL": "GB", "UK": "GB",
    "USA": "US", "FRA": "FR", "ITA": "IT", "ESP": "ES", "NLD": "NL",
    "BEL": "BE", "POL": "PL", "FIN": "FI", "SWE": "SE", "NOR": "NO",
    "DNK": "DK", "AUT": "AT", "CHE": "CH", "CZE": "CZ", "SVK": "SK",
    "HUN": "HU", "ROU": "RO", "BGR": "BG", "UKR": "UA", "PRT": "PT",
    "IRL": "IE", "AUS": "AU", "NZL": "NZ", "CAN": "CA", "BRA": "BR",
    "ARG": "AR", "JPN": "JP", "KOR": "KR", "GRC": "GR", "TUR": "TR",
    "HRV": "HR", "SVN": "SI", "SRB": "RS", "ZAF": "ZA", "MEX": "MX",
    "LATVIA": "LV", "LITHUANIA": "LT", "ESTONIA": "EE", "GERMANY": "DE",
    "UNITEDKINGDOM": "GB", "GREATBRITAIN": "GB", "ENGLAND": "GB",
    "UNITEDSTATES": "US", "FRANCE": "FR", "ITALY": "IT", "SPAIN": "ES",
    "NETHERLANDS": "NL", "BELGIUM": "BE", "POLAND": "PL", "FINLAND": "FI",
    "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK", "AUSTRIA": "AT",
    "SWITZERLAND": "CH", "CZECHIA": "CZ", "CZECHREPUBLIC": "CZ",
    "SLOVAKIA": "SK", "HUNGARY": "HU", "ROMANIA": "RO", "BULGARIA": "BG",
    "UKRAINE": "UA", "PORTUGAL": "PT", "IRELAND": "IE", "AUSTRALIA": "AU",
    "NEWZEALAND": "NZ", "CANADA": "CA", "BRAZIL": "BR", "ARGENTINA": "AR",
    "JAPAN": "JP", "SOUTHKOREA": "KR", "GREECE": "GR", "TURKEY": "TR",
    "CROATIA": "HR", "SLOVENIA": "SI", "SERBIA": "RS", "SOUTHAFRICA": "ZA",
}


def normalize_country_code(raw: str | None) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    if len(s) >= 2 and all(0x1F1E6 <= ord(ch) <= 0x1F1FF for ch in s[:2]):
        return chr(ord(s[0]) - 0x1F1E6 + ord("A")) + chr(ord(s[1]) - 0x1F1E6 + ord("A"))
    clean = re.sub(r"[^A-Za-z]", "", s).upper()
    if clean in ALPHA3_TO_2:
        return ALPHA3_TO_2[clean]
    if len(clean) == 2:
        return clean
    return ""


def country_to_flag(code: str) -> str:
    cc = normalize_country_code(code)
    if len(cc) != 2:
        return ""
    return chr(0x1F1E6 + ord(cc[0]) - ord("A")) + chr(0x1F1E6 + ord(cc[1]) - ord("A"))


def format_short_name(raw_name: str) -> str:
    name = " ".join(str(raw_name or "").strip().split())
    if not name:
        return "Unknown Driver"
    parts = name.split(" ")
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0][0].upper()}. {' '.join(parts[1:])}"


def login_wss(page) -> bool:
    email = os.environ.get("WSS_EMAIL", "").strip()
    password = os.environ.get("WSS_PASSWORD", "").strip()
    if not email or not password:
        print("WSS_EMAIL or WSS_PASSWORD not set.")
        return False

    print("Logging into World Sim Series...")
    page.goto(LOGIN_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)

    try:
        sign_in_btn = page.locator(
            'button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Log in"), a:has-text("Log in")'
        ).first
        if sign_in_btn.is_visible(timeout=2000) and not page.locator('input[type="password"]').is_visible(timeout=1000):
            sign_in_btn.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass

    email_input = page.locator(
        'input[type="email"], input[name*="email" i], input[formcontrolname*="email" i], input[placeholder*="email" i]'
    ).first
    pass_input = page.locator('input[type="password"]').first

    email_input.wait_for(state="visible", timeout=20000)
    email_input.fill(email)
    pass_input.fill(password)

    submit_btn = page.locator(
        'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")'
    ).first
    submit_btn.click()

    try:
        page.wait_for_url(lambda u: "/login" not in u.lower(), timeout=25000)
    except Exception:
        page.wait_for_timeout(4000)

    page.wait_for_load_state("networkidle", timeout=25000)
    print("Login complete. Current URL:", page.url)
    return True


def collect_finished_series_from_manager(page) -> list[dict[str, str]]:
    """Open /series-manager#/, scroll all cards, and collect every series under FINISHED SERIES."""
    page.goto(SERIES_MANAGER_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(3000)

    # Scroll repeatedly to load all Finished Series rows
    prev_height = 0
    for _ in range(15):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)
        curr_height = page.evaluate("document.body.scrollHeight")
        if curr_height == prev_height:
            break
        prev_height = curr_height

    # Collect cards positioned below the "FINISHED SERIES" header
    series_items = page.evaluate(
        """() => {
            const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
            let finishedTop = null;
            for (const el of headers) {
                const txt = (el.innerText || '').trim().toUpperCase();
                if (txt === 'FINISHED SERIES') {
                    const rect = el.getBoundingClientRect();
                    finishedTop = rect.top + window.scrollY;
                    break;
                }
            }

            const seen = new Set();
            const out = [];

            // Cards in series-manager either use <a href="/series-manager/2690..."> or clickable card containers
            const anchors = Array.from(document.querySelectorAll('a[href*="/series-manager/"]'));
            for (const a of anchors) {
                const href = a.getAttribute('href') || '';
                const m = /\\/series-manager\\/(\\d+)/.exec(href);
                if (!m) continue;
                const sid = m[1];
                if (seen.has(sid)) continue;

                const card = a.closest('article, [class*="card"], [class*="series"], [class*="item"]') || a;
                const cardTop = card.getBoundingClientRect().top + window.scrollY;
                const cardText = (card.innerText || '').trim();
                const upper = cardText.toUpperCase();

                // Must be in the Finished Series section (below FINISHED SERIES header or marked Finished (X/X))
                const inFinishedSection = finishedTop !== null ? (cardTop >= finishedTop - 10) : upper.includes('FINISHED (');
                if (!inFinishedSection) continue;
                if (upper.includes('IN PROGRESS') || upper.includes('DRAFT (')) continue;

                seen.add(sid);

                const lines = cardText
                    .split('\\n')
                    .map(s => s.trim())
                    .filter(s =>
                        s &&
                        !s.toUpperCase().startsWith('BY ') &&
                        !s.toUpperCase().startsWith('FINISHED') &&
                        s.toUpperCase() !== 'START' &&
                        s.toUpperCase() !== 'END' &&
                        !/^\\d{1,2}(st|nd|rd|th)\\s+[A-Za-z]+/i.test(s)
                    );

                const titleEl = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
                const name = (titleEl ? titleEl.innerText : (lines[0] || ('Series ' + sid))).trim();

                let thumb = '';
                const img = card.querySelector('img');
                if (img && img.src) {
                    thumb = img.src;
                } else {
                    const bgEl = [card, ...Array.from(card.querySelectorAll('*'))].find(el => {
                        const bg = getComputedStyle(el).backgroundImage;
                        return bg && bg !== 'none' && bg.includes('url(');
                    });
                    if (bgEl) {
                        const um = /url\\(["']?(.*?)["']?\\)/.exec(getComputedStyle(bgEl).backgroundImage);
                        if (um) thumb = um[1];
                    }
                }

                // Extract date range if visible
                const dateLines = cardText.split('\\n').map(s => s.trim()).filter(s => /^\\d{1,2}(st|nd|rd|th)\\s+[A-Za-z]+/i.test(s));
                const dateLabel = dateLines.length ? dateLines[dateLines.length - 1] : '';

                out.push({
                    seriesId: sid,
                    name,
                    thumbnail: thumb,
                    date: dateLabel
                });
            }
            return out;
        }"""
    )
    return series_items


def find_last_event_id_for_series(page, series_id: str) -> str:
    """Open /series-manager/<series_id>#/events, expand the last round, and extract its /events/<event_id> link."""
    events_tab_url = f"https://paddock.worldsimseries.com/series-manager/{series_id}#/events"
    page.goto(events_tab_url, wait_until="networkidle", timeout=35000)
    page.wait_for_timeout(2000)

    # Click the last ROUND #N accordion header if any exist
    try:
        rounds = page.locator('[class*="round"], [class*="accordion"], div, button').filter(has_text=re.compile(r"^ROUND\s*#\d+", re.I))
        count = rounds.count()
        if count > 0:
            rounds.nth(count - 1).click()
            page.wait_for_timeout(1500)
    except Exception:
        pass

    # Look for any /events/<id> link rendered inside the expanded round card
    event_id = page.evaluate(
        """() => {
            const links = Array.from(document.querySelectorAll('a[href*="/events/"]'));
            const ids = [];
            for (const a of links) {
                const m = /\\/events\\/(\\d+)/.exec(a.getAttribute('href') || '');
                if (m) ids.push(m[1]);
            }
            return ids.length ? ids[ids.length - 1] : '';
        }"""
    )
    return event_id


def find_driver_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        sample = payload[0]
        if any(k in sample for k in ("driver", "driverName", "fullName", "points", "position", "user")):
            return payload
    if isinstance(payload, dict):
        for v in payload.values():
            found = find_driver_rows(v)
            if found:
                return found
    return []


def extract_top3_from_event_standings(page, event_id: str) -> list[dict[str, Any]]:
    """Open /events/<event_id>/standings#/ and extract Top 3 driver standings (Pos, Flag, Name, Points)."""
    standings_url = f"https://paddock.worldsimseries.com/events/{event_id}/standings#/"
    captured_json: list[Any] = []

    def on_response(resp):
        try:
            url = resp.url.lower()
            if resp.status == 200 and any(k in url for k in ("standing", "classification", "leaderboard", "driver", "point")):
                if "json" in resp.headers.get("content-type", ""):
                    captured_json.append(resp.json())
        except Exception:
            pass

    page.on("response", on_response)
    try:
        page.goto(standings_url, wait_until="networkidle", timeout=35000)
        page.wait_for_timeout(2500)
    except Exception:
        pass
    finally:
        page.remove_listener("response", on_response)

    # 1. Try captured standings API JSON first
    for blob in captured_json:
        rows = find_driver_rows(blob)
        if rows:
            top3 = []
            for idx, r in enumerate(rows[:3], start=1):
                driver = r.get("driver") if isinstance(r.get("driver"), dict) else {}
                user = r.get("user") if isinstance(r.get("user"), dict) else {}
                raw_name = (
                    r.get("driverName") or r.get("fullName") or r.get("name")
                    or driver.get("fullName") or driver.get("name")
                    or f"{driver.get('firstName', '')} {driver.get('lastName', '')}".strip()
                    or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
                    or user.get("name") or ""
                )
                raw_cc = (
                    r.get("countryCode") or r.get("country") or r.get("nationality")
                    or driver.get("countryCode") or driver.get("country") or driver.get("nationality")
                    or user.get("countryCode") or user.get("country") or user.get("nationality") or ""
                )
                cc = normalize_country_code(raw_cc)
                pts = r.get("points") if r.get("points") is not None else r.get("score")
                if raw_name:
                    top3.append({
                        "position": idx,
                        "name": format_short_name(raw_name),
                        "fullName": raw_name.strip(),
                        "countryCode": cc,
                        "flag": country_to_flag(cc),
                        "points": pts,
                    })
            if top3:
                return top3

    # 2. Parse rendered DRIVER STANDINGS table rows (Pos | Driver (with flag) | Points)
    dom_rows = page.evaluate(
        """() => {
            const out = [];
            const rowEls = Array.from(document.querySelectorAll('table tbody tr, [class*="standing"] [class*="row"], [class*="table"] [class*="row"]'));
            for (const row of rowEls) {
                if (out.length >= 3) break;
                const cells = Array.from(row.querySelectorAll('td, [class*="cell"], [class*="col"]'))
                    .map(c => (c.innerText || '').trim())
                    .filter(Boolean);
                if (cells.length < 2) continue;

                // Extract country flag from <img>, <span class="fi fi-de">, or data-country inside the row
                let country = '';
                const flagCandidates = Array.from(row.querySelectorAll('img, span, i, svg, [class*="flag"], [class*="fi-"], [data-country]'));
                for (const el of flagCandidates) {
                    const cls = (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
                    const cm = /(?:^|\\s|-)fi-([a-zA-Z]{2})(?:\\s|$|-)|flag-icon-([a-zA-Z]{2})(?:\\s|$)|flag-([a-zA-Z]{2})(?:\\s|$)/i.exec(cls);
                    if (cm) {
                        country = cm[1] || cm[2] || cm[3];
                        break;
                    }
                    const attr = el.getAttribute('data-country') || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('src') || '';
                    const um = /(?:flags?\\/|\\/)([a-zA-Z]{2})\\.(svg|png|webp|jpg)/i.exec(attr);
                    if (um) {
                        country = um[1];
                        break;
                    }
                    if (/^[a-zA-Z]{2,3}$/.test(attr.trim())) {
                        country = attr.trim();
                        break;
                    }
                }

                out.push({ cells, country });
            }
            return out;
        }"""
    )

    top3 = []
    for idx, r in enumerate(dom_rows[:3], start=1):
        cells = r.get("cells") or []
        raw_name = ""
        pts = None
        for c in cells:
            if c.isdigit() and not raw_name:
                continue
            if not raw_name and re.search(r"[A-Za-z]{2,}", c):
                raw_name = c
                continue
            if raw_name and pts is None and re.match(r"^\d+(\.\d+)?$", c):
                pts = int(float(c)) if float(c).is_integer() else float(c)
                break
        if raw_name:
            cc = normalize_country_code(r.get("country"))
            top3.append({
                "position": idx,
                "name": format_short_name(raw_name),
                "fullName": raw_name,
                "countryCode": cc,
                "flag": country_to_flag(cc),
                "points": pts,
            })
    return top3


def main() -> None:
    series_out: list[dict[str, Any]] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        login_wss(page)

        finished_series = collect_finished_series_from_manager(page)
        print(f"Found {len(finished_series)} finished series in series-manager.")

        for s in finished_series:
            sid = s["seriesId"]
            event_id = find_last_event_id_for_series(page, sid)
            if not event_id:
                print(f"Skipping {s['name']} (ID {sid}): no round event ID found.")
                continue

            top3 = extract_top3_from_event_standings(page, event_id)
            standings_url = f"https://paddock.worldsimseries.com/events/{event_id}/standings#/"

            series_out.append({
                "id": event_id,
                "seriesId": sid,
                "name": s["name"],
                "series": s["name"],
                "status": "finished",
                "date": s["date"],
                "thumbnail": s["thumbnail"],
                "url": f"https://paddock.worldsimseries.com/events/{event_id}#/",
                "standingsUrl": standings_url,
                "top3": top3,
            })
            print(f"Loaded {s['name']} -> event {event_id} ({len(top3)} podium entries)")

        browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "organizationUrl": SERIES_MANAGER_URL,
        "events": series_out,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(series_out)} finished series to {OUT_PATH}")


if __name__ == "__main__":
    main()
