#!/usr/bin/env python3
"""Log into World Sim Series, paginate all Finished Series in /series-manager#/, open each series' final round standings, and save Top 3 podiums."""

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


def scrape_visible_finished_series(page) -> list[dict[str, str]]:
    """Extract all Finished Series cards currently rendered on /series-manager#/."""
    return page.evaluate(
        """() => {
            const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
            let finishedTop = null;
            for (const el of headers) {
                const txt = (el.innerText || '').trim().toUpperCase();
                if (txt === 'FINISHED SERIES') {
                    finishedTop = el.getBoundingClientRect().top + window.scrollY;
                    break;
                }
            }

            const seen = new Set();
            const out = [];
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


def collect_finished_series_from_manager(page) -> list[dict[str, str]]:
    """Open /series-manager#/ and click through every pagination page (1, 2, 3, 4...) of FINISHED SERIES."""
    page.goto(SERIES_MANAGER_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(3000)

    all_series: list[dict[str, str]] = []
    seen_ids: set[str] = set()

    for page_num in range(1, 30):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)

        batch = scrape_visible_finished_series(page)
        first_id_before = batch[0]["seriesId"] if batch else ""
        new_count = 0
        for item in batch:
            sid = item["seriesId"]
            if sid not in seen_ids:
                seen_ids.add(sid)
                all_series.append(item)
                new_count += 1

        print(f"Finished Series page {page_num}: +{new_count} new series (total {len(all_series)})")
        if new_count == 0 and page_num > 1:
            break

        # Click the actual <a> or <button> inside the bottom pagination bar (not the outer <li>)
        clicked_label = page.evaluate(
            """(nextNum) => {
                const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
                let finishedTop = 0;
                for (const el of headers) {
                    if ((el.innerText || '').trim().toUpperCase() === 'FINISHED SERIES') {
                        finishedTop = el.getBoundingClientRect().top + window.scrollY;
                        break;
                    }
                }

                const clickables = Array.from(document.querySelectorAll('a, button'))
                    .filter(el => {
                        if (el.offsetParent === null) return false;
                        const top = el.getBoundingClientRect().top + window.scrollY;
                        return top >= finishedTop;
                    });

                const isDisabled = (el) => {
                    const cls = (el.className || '').toLowerCase();
                    const pCls = (el.parentElement && el.parentElement.className || '').toLowerCase();
                    return cls.includes('disabled') || pCls.includes('disabled') || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
                };

                for (const el of clickables) {
                    const txt = (el.innerText || '').trim();
                    if (txt === String(nextNum) && !isDisabled(el)) {
                        el.scrollIntoView({ block: 'center' });
                        el.click();
                        return txt;
                    }
                }
                for (const el of clickables) {
                    const txt = (el.innerText || '').trim();
                    if ((txt === '›' || txt === '>' || txt === 'Next') && !isDisabled(el)) {
                        el.scrollIntoView({ block: 'center' });
                        el.click();
                        return txt;
                    }
                }
                return '';
            }""",
            page_num + 1,
        )

        if not clicked_label:
            break

        # Wait until Angular swaps the rendered series cards so we don't re-scrape the old page
        if first_id_before:
            try:
                page.wait_for_function(
                    """(prevId) => {
                        const anchors = Array.from(document.querySelectorAll('a[href*="/series-manager/"]'));
                        const ids = anchors
                            .map(a => (/\\/series-manager\\/(\\d+)/.exec(a.getAttribute('href') || '') || [])[1])
                            .filter(Boolean);
                        return ids.length > 0 && !ids.includes(prevId);
                    }""",
                    arg=first_id_before,
                    timeout=8000,
                )
            except Exception:
                page.wait_for_timeout(2000)
        else:
            page.wait_for_timeout(2000)

    return all_series


def find_last_event_id_for_series(page, series_id: str) -> str:
    """Open /series-manager/<series_id>#/events, expand the last round, and navigate to its /events/<id> page."""
    events_tab_url = f"https://paddock.worldsimseries.com/series-manager/{series_id}#/events"
    captured_ids: list[str] = []

    def scan_obj(obj: Any) -> None:
        if isinstance(obj, dict):
            # Look for event objects inside a series schedule/rounds response
            if any(k in obj for k in ("trackId", "track", "startsAt", "startDate", "roundNumber", "round")):
                for k in ("eventId", "id"):
                    val = str(obj.get(k, ""))
                    if val.isdigit() and val != str(series_id):
                        captured_ids.append(val)
            elif "eventId" in obj and str(obj["eventId"]).isdigit():
                captured_ids.append(str(obj["eventId"]))
            for v in obj.values():
                scan_obj(v)
        elif isinstance(obj, list):
            for item in obj:
                scan_obj(item)

    def on_response(resp):
        try:
            if resp.status == 200 and "json" in resp.headers.get("content-type", ""):
                scan_obj(resp.json())
        except Exception:
            pass

    page.on("response", on_response)
    try:
        page.goto(events_tab_url, wait_until="networkidle", timeout=35000)
        page.wait_for_timeout(2500)
    finally:
        page.remove_listener("response", on_response)

    if captured_ids:
        unique_ids = list(dict.fromkeys(captured_ids))
        return unique_ids[-1]

    # Fallback: expand the last ROUND #N bar in the UI and click the event card inside it
    try:
        round_rows = page.locator('text=/ROUND\\s*#?\\s*\\d+/i')
        cnt = round_rows.count()
        if cnt > 0:
            last_round = round_rows.nth(cnt - 1)
            last_round.scroll_into_view_if_needed()
            last_round.click()
            page.wait_for_timeout(1500)

        # Check if any /events/<id> link appeared
        eid = page.evaluate(
            """() => {
                const links = Array.from(document.querySelectorAll('a[href*="/events/"]'));
                const ids = links
                    .map(a => (/\\/events\\/(\\d+)/.exec(a.getAttribute('href') || '') || [])[1])
                    .filter(Boolean);
                return ids.length ? ids[ids.length - 1] : '';
            }"""
        )
        if eid:
            return eid

        # Click the expanded event card (containing "BY AMK RACING ORGANIZATION" or "FINISHED") to trigger Angular navigation
        event_card = page.locator('text=/BY AMK RACING ORGANIZATION/i').last
        if event_card.is_visible(timeout=2000):
            event_card.click()
            page.wait_for_url(re.compile(r"/events/\d+"), timeout=12000)
            m = re.search(r"/events/(\d+)", page.url)
            if m:
                return m.group(1)
    except Exception:
        pass

    return ""


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
                    const bg = getComputedStyle(el).backgroundImage || '';
                    const bm = /(?:flags?\\/|\\/)([a-zA-Z]{2})\\.(svg|png|webp|jpg)/i.exec(bg);
                    if (bm) {
                        country = bm[1];
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
        print(f"Found {len(finished_series)} finished series across all pages in series-manager.")

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
