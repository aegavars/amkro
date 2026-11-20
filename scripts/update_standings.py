#!/usr/bin/env python3
"""Log into World Sim Series, read AMKRO's Finished Series, and extract series title, thumbnail, Top 3 (with country flags & N. Surname), and full standings URL."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from playwright.sync_api import sync_playwright

ORG_ID = "2b746de0d67e2930b18aacfa19e07eeb"
LOGIN_URL = "https://paddock.worldsimseries.com/login"
ORG_SERIES_URL = f"https://paddock.worldsimseries.com/organizations/{ORG_ID}#/series"
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
    # Convert regional indicator flag emoji back to 2-letter ISO code if needed
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
        print("WSS_EMAIL or WSS_PASSWORD not set; continuing without login.")
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


def collect_finished_series(page) -> list[dict[str, str]]:
    page.goto(ORG_SERIES_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(3000)

    # Scroll & click any "Load more" / "Show more" inside the Finished series area
    for _ in range(10):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(700)
        clicked = page.evaluate(
            """() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                for (const b of btns) {
                    const txt = (b.innerText || '').trim().toLowerCase();
                    if ((txt.includes('load more') || txt.includes('show more') || txt === 'more') && b.offsetParent !== null) {
                        b.click();
                        return true;
                    }
                }
                return false;
            }"""
        )
        if not clicked:
            break

    series_list = page.evaluate(
        """() => {
            const badLabels = new Set([
                'FINISHED', 'ONGOING', 'DRAFT', 'DRAFTS', 'LIVE', 'UPCOMING',
                'SERIES', 'STANDINGS', 'RESULTS', 'OVERVIEW', 'AMKRO', 'VIEW', 'OPEN'
            ]);

            // Find the "Finished" section heading/container on the Series page
            const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, section, span'));
            let finishedRoot = null;
            for (const el of allElements) {
                const ownText = Array.from(el.childNodes)
                    .filter(n => n.nodeType === Node.TEXT_NODE)
                    .map(n => n.textContent.trim())
                    .join(' ')
                    .toLowerCase();
                if (ownText === 'finished' || ownText === 'finished series') {
                    // Walk up to the section container holding this heading and its cards
                    let parent = el.parentElement;
                    while (parent && parent !== document.body) {
                        const links = parent.querySelectorAll('a[href*="/series/"], a[href*="/events/"]');
                        const textLower = (parent.innerText || '').toLowerCase();
                        // Stop before climbing into a container that also holds Ongoing or Draft
                        if (links.length > 0 && !textLower.includes('ongoing') && !textLower.includes('draft')) {
                            finishedRoot = parent;
                            break;
                        }
                        if (links.length > 0 && parent.parentElement && (parent.parentElement.innerText || '').toLowerCase().includes('ongoing')) {
                            finishedRoot = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    if (finishedRoot) break;
                }
            }

            const scope = finishedRoot || document;
            const anchors = Array.from(scope.querySelectorAll('a[href*="/series/"], a[href*="/events/"]'));
            const seen = new Set();
            const out = [];

            for (const a of anchors) {
                const href = a.getAttribute('href') || '';
                const m = /\\/(series|events)\\/(\\d+)/.exec(href);
                if (!m) continue;
                const kind = m[1];
                const id = m[2];
                const key = kind + ':' + id;
                if (seen.has(key)) continue;

                const card = a.closest('article, [class*="card"], [class*="series"], [class*="event"], [class*="item"]') || a;
                const cardText = (card.innerText || '').trim();

                // If we fell back to full document, only keep cards marked Finished and NOT Ongoing/Draft
                if (!finishedRoot) {
                    const upper = cardText.toUpperCase();
                    if (!upper.includes('FINISHED') || upper.includes('ONGOING') || upper.includes('DRAFT')) continue;
                }

                // Skip any card still showing an incomplete round fraction like 8/12
                const progMatch = /\\b(\\d{1,2})\\s*\\/\\s*(\\d{1,2})\\b/.exec(cardText);
                if (progMatch) {
                    const done = parseInt(progMatch[1], 10);
                    const total = parseInt(progMatch[2], 10);
                    if (done < total) continue;
                }

                seen.add(key);

                // Extract actual series title (ignoring status badges and round counters)
                const lines = cardText
                    .split('\\n')
                    .map(s => s.trim())
                    .filter(s => s && !badLabels.has(s.toUpperCase()) && !/^\\d+\\s*\\/\\s*\\d+$/.test(s) && !/^\\d+\\s*(rounds?|events?|races?)$/i.test(s));

                const heading = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
                let title = heading ? (heading.innerText || '').trim() : '';
                if (!title || badLabels.has(title.toUpperCase())) {
                    title = lines[0] || ('Series ' + id);
                }

                // Extract thumbnail image or CSS background-image
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

                out.push({
                    kind,
                    id,
                    name: title,
                    thumbnail: thumb,
                    href: href.startsWith('http') ? href : ('https://paddock.worldsimseries.com' + (href.startsWith('/') ? '' : '/') + href)
                });
            }
            return out;
        }"""
    )
    return series_list


def extract_top3_and_standings_url(page, item: dict[str, str]) -> tuple[list[dict[str, Any]], str]:
    kind = item["kind"]
    sid = item["id"]

    # Candidate standings URLs for both /series/<id> and /events/<id>
    if kind == "series":
        candidate_urls = [
            f"https://paddock.worldsimseries.com/series/{sid}/standings#/",
            f"https://paddock.worldsimseries.com/series/{sid}#/",
        ]
    else:
        candidate_urls = [
            f"https://paddock.worldsimseries.com/events/{sid}/standings#/",
            f"https://paddock.worldsimseries.com/events/{sid}#/",
        ]

    final_standings_url = candidate_urls[0]

    for target_url in candidate_urls:
        captured_json: list[Any] = []

        def on_response(resp):
            try:
                url = resp.url.lower()
                if resp.status == 200 and any(
                    k in url for k in ("standing", "result", "classification", "leaderboard", "driver", "series")
                ):
                    if "json" in resp.headers.get("content-type", ""):
                        captured_json.append(resp.json())
            except Exception:
                pass

        page.on("response", on_response)
        try:
            page.goto(target_url, wait_until="networkidle", timeout=35000)
            page.wait_for_timeout(2000)

            # If we landed on the series overview page, click the "Standings" tab/link if present
            if "/standings" not in page.url.lower():
                st_link = page.locator('a[href*="/standings"], button:has-text("Standings"), a:has-text("Standings")').first
                if st_link.is_visible(timeout=2000):
                    st_link.click()
                    page.wait_for_load_state("networkidle", timeout=20000)
                    page.wait_for_timeout(2000)
        except Exception:
            pass
        finally:
            page.remove_listener("response", on_response)

        if "/standings" in page.url.lower():
            final_standings_url = page.url

        # 1. Parse captured API JSON responses
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
                    return top3, final_standings_url

        # 2. Fallback: parse rendered DOM rows + flag elements on the Standings page
        dom_rows = page.evaluate(
            """() => {
                const out = [];
                const rowEls = Array.from(document.querySelectorAll('table tbody tr, [class*="standing"] [class*="row"], [class*="table"] [class*="row"]'));
                for (const row of rowEls) {
                    if (out.length >= 3) break;
                    const text = (row.innerText || '').trim();
                    if (!text) continue;

                    let country = '';
                    const candidates = Array.from(row.querySelectorAll('img, span, i, svg, [class*="flag"], [class*="fi-"], [data-country]'));
                    for (const el of candidates) {
                        const cls = (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
                        const cm = /(?:^|\\s|-)fi-([a-zA-Z]{2})(?:\\s|$|-)|flag-icon-([a-zA-Z]{2})(?:\\s|$)|flag-([a-zA-Z]{2})(?:\\s|$)/i.exec(cls);
                        if (cm) {
                            country = cm[1] || cm[2] || cm[3];
                            break;
                        }
                        const attr = el.getAttribute('data-country') || el.getAttribute('data-code') || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('src') || '';
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

                    const links = Array.from(row.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean);
                    const cells = Array.from(row.querySelectorAll('td, [class*="cell"], [class*="col"]')).map(c => c.innerText.trim()).filter(Boolean);
                    out.push({ text, country, links, cells });
                }
                return out;
            }"""
        )

        top3 = []
        for idx, r in enumerate(dom_rows[:3], start=1):
            raw_name = ""
            for candidate in (r.get("links") or []) + (r.get("cells") or []):
                cleaned = re.sub(r"^\d+\.?\s*", "", candidate).strip()
                if len(cleaned) >= 3 and re.search(r"[A-Za-z]{2,}", cleaned) and not cleaned.isdigit():
                    raw_name = cleaned
                    break
            if not raw_name:
                for ln in [x.strip() for x in r.get("text", "").splitlines() if x.strip()]:
                    if len(ln) >= 3 and re.search(r"[A-Za-z]{2,}", ln) and not ln.isdigit():
                        raw_name = ln
                        break
            if raw_name:
                cc = normalize_country_code(r.get("country"))
                top3.append({
                    "position": idx,
                    "name": format_short_name(raw_name),
                    "fullName": raw_name,
                    "countryCode": cc,
                    "flag": country_to_flag(cc),
                    "points": None,
                })
        if top3:
            return top3, final_standings_url

    return [], final_standings_url


def main() -> None:
    series_out: list[dict[str, Any]] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        login_wss(page)

        finished_series = collect_finished_series(page)
        print(f"Found {len(finished_series)} finished series on Series tab.")

        seen_titles: set[str] = set()
        for item in finished_series:
            title_key = item["name"].strip().lower()
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)

            top3, standings_url = extract_top3_and_standings_url(page, item)
            series_out.append({
                "id": item["id"],
                "name": item["name"],
                "series": item["name"],
                "status": "finished",
                "thumbnail": item["thumbnail"],
                "url": item["href"],
                "standingsUrl": standings_url,
                "top3": top3,
            })

        browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "organizationUrl": ORG_SERIES_URL,
        "events": series_out,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(series_out)} finished series to {OUT_PATH}")


if __name__ == "__main__":
    main()
