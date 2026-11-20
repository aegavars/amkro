#!/usr/bin/env python3
"""Log into World Sim Series, render AMKRO finished events, and extract thumbnails + Top 3 podiums."""

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
ORG_FINISHED_URL = f"https://paddock.worldsimseries.com/organizations/{ORG_ID}#/finished-events"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "standings.json"


def login_wss(page) -> bool:
    email = os.environ.get("WSS_EMAIL", "").strip()
    password = os.environ.get("WSS_PASSWORD", "").strip()
    if not email or not password:
        print("WSS_EMAIL or WSS_PASSWORD not set; continuing without login.")
        return False

    print("Logging into World Sim Series...")
    page.goto(LOGIN_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)

    # If redirected to a sign-in button first, click it
    try:
        sign_in_btn = page.locator('button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Log in"), a:has-text("Log in")').first
        if sign_in_btn.is_visible(timeout=2000) and not page.locator('input[type="password"]').is_visible(timeout=1000):
            sign_in_btn.click()
            page.wait_for_timeout(1500)
    except Exception:
        pass

    email_input = page.locator('input[type="email"], input[name*="email" i], input[formcontrolname*="email" i], input[placeholder*="email" i]').first
    pass_input = page.locator('input[type="password"]').first

    email_input.wait_for(state="visible", timeout=20000)
    email_input.fill(email)
    pass_input.fill(password)

    submit_btn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').first
    submit_btn.click()

    # Wait until redirected away from /login
    try:
        page.wait_for_url(lambda u: "/login" not in u.lower(), timeout=25000)
    except Exception:
        page.wait_for_timeout(4000)

    page.wait_for_load_state("networkidle", timeout=25000)
    print("Login complete. Current URL:", page.url)
    return True


def country_to_flag(code_or_name: str | None) -> str:
    if not code_or_name:
        return ""
    raw = str(code_or_name).strip()
    if len(raw) >= 2 and all(0x1F1E6 <= ord(ch) <= 0x1F1FF for ch in raw[:2]):
        return raw[:2]

    clean = re.sub(r"[^A-Za-z]", "", raw).upper()
    name_map = {
        "LATVIA": "LV", "LITHUANIA": "LT", "ESTONIA": "EE", "GERMANY": "DE",
        "UNITEDKINGDOM": "GB", "GREATBRITAIN": "GB", "ENGLAND": "GB",
        "UNITEDSTATES": "US", "FRANCE": "FR", "ITALY": "IT", "SPAIN": "ES",
        "NETHERLANDS": "NL", "BELGIUM": "BE", "POLAND": "PL", "FINLAND": "FI",
        "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK", "AUSTRIA": "AT",
        "SWITZERLAND": "CH", "CZECHIA": "CZ", "CZECHREPUBLIC": "CZ",
        "SLOVAKIA": "SK", "HUNGARY": "HU", "ROMANIA": "RO", "BULGARIA": "BG",
        "UKRAINE": "UA", "PORTUGAL": "PT", "IRELAND": "IE", "AUSTRALIA": "AU",
        "NEWZEALAND": "NZ", "CANADA": "CA", "BRAZIL": "BR", "ARGENTINA": "AR",
        "JAPAN": "JP", "SOUTHKOREA": "KR",
        "LVA": "LV", "LTU": "LT", "EST": "EE", "DEU": "DE", "GER": "DE",
        "GBR": "GB", "ENG": "GB", "USA": "US", "FRA": "FR", "ITA": "IT",
        "ESP": "ES", "NLD": "NL", "BEL": "BE", "POL": "PL", "FIN": "FI",
        "SWE": "SE", "NOR": "NO", "DNK": "DK", "AUT": "AT", "CHE": "CH",
        "CZE": "CZ", "SVK": "SK", "HUN": "HU", "ROU": "RO", "BGR": "BG",
        "UKR": "UA", "PRT": "PT", "IRL": "IE", "AUS": "AU", "NZL": "NZ",
        "CAN": "CA", "BRA": "BR", "ARG": "AR", "JPN": "JP", "KOR": "KR",
    }
    if clean in name_map:
        clean = name_map[clean]
    if len(clean) != 2:
        return ""
    return chr(0x1F1E6 + ord(clean[0]) - ord("A")) + chr(0x1F1E6 + ord(clean[1]) - ord("A"))


def format_short_name(raw_name: str) -> str:
    name = " ".join(str(raw_name or "").strip().split())
    if not name:
        return "Unknown Driver"
    parts = name.split(" ")
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0][0].upper()}. {' '.join(parts[1:])}"


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


def extract_top3_from_page(page, event_id: str) -> list[dict[str, Any]]:
    standings_url = f"https://paddock.worldsimseries.com/events/{event_id}/standings#/"
    captured_json: list[Any] = []

    def on_response(resp):
        try:
            url = resp.url.lower()
            if resp.status == 200 and any(k in url for k in ("standing", "result", "classification", "leaderboard", "driver")):
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
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
                cc = (
                    r.get("countryCode") or r.get("country") or r.get("nationality")
                    or driver.get("countryCode") or driver.get("country")
                    or user.get("countryCode") or user.get("country") or ""
                )
                pts = r.get("points") if r.get("points") is not None else r.get("score")
                if raw_name:
                    top3.append({
                        "position": idx,
                        "name": format_short_name(raw_name),
                        "fullName": raw_name.strip(),
                        "countryCode": str(cc).upper(),
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
                const text = (row.innerText || '').trim();
                if (!text) continue;
                const flagImg = row.querySelector('img[src*="flag"], img[alt*="flag"], [class*="flag"]');
                let country = '';
                if (flagImg) {
                    country = flagImg.getAttribute('alt') || flagImg.getAttribute('title') || flagImg.getAttribute('src') || '';
                    const m = /\\/([a-zA-Z]{2})\\.(svg|png|webp)/i.exec(country);
                    if (m) country = m[1];
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
            lines = [ln.strip() for ln in r.get("text", "").splitlines() if ln.strip()]
            for ln in lines:
                if len(ln) >= 3 and re.search(r"[A-Za-z]{2,}", ln) and not ln.isdigit():
                    raw_name = ln
                    break
        if raw_name:
            top3.append({
                "position": idx,
                "name": format_short_name(raw_name),
                "fullName": raw_name,
                "countryCode": str(r.get("country") or "").upper(),
                "flag": country_to_flag(r.get("country")),
                "points": None,
            })
    return top3


def main() -> None:
    events: list[dict[str, Any]] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        login_wss(page)

        page.goto(ORG_FINISHED_URL, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(3000)

        for _ in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(800)

        raw_cards = page.evaluate(
            """() => {
                const seen = new Set();
                const results = [];
                const anchors = Array.from(document.querySelectorAll('a[href*="/events/"]'));
                for (const a of anchors) {
                    const href = a.getAttribute('href') || '';
                    const m = /\\/events\\/(\\d+)/.exec(href);
                    if (!m) continue;
                    const id = m[1];
                    if (seen.has(id)) continue;
                    seen.add(id);

                    const card = a.closest('article, [class*="card"], [class*="event"], [class*="item"]') || a;
                    const titleEl = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
                    const name = (titleEl ? titleEl.innerText : a.innerText || '').trim().split('\\n')[0].trim();

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
                            const bg = getComputedStyle(bgEl).backgroundImage;
                            const um = /url\\(["']?(.*?)["']?\\)/.exec(bg);
                            if (um) thumb = um[1];
                        }
                    }

                    const dateEl = card.querySelector('time, [class*="date"]');
                    const dateText = dateEl ? dateEl.innerText.trim() : '';

                    results.push({
                        id,
                        name: name || ('Event ' + id),
                        thumbnail: thumb,
                        date: dateText
                    });
                }
                return results;
            }"""
        )

        print(f"Found {len(raw_cards)} finished events on organization page.")

        for card in raw_cards:
            eid = card["id"]
            top3 = extract_top3_from_page(page, eid)
            events.append({
                "id": eid,
                "name": card["name"],
                "series": "AMKRO",
                "status": "finished",
                "date": card["date"],
                "thumbnail": card["thumbnail"],
                "url": f"https://paddock.worldsimseries.com/events/{eid}#/",
                "standingsUrl": f"https://paddock.worldsimseries.com/events/{eid}/standings#/",
                "top3": top3,
            })

        browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "organizationUrl": ORG_FINISHED_URL,
        "events": events,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(events)} finished events to {OUT_PATH}")


if __name__ == "__main__":
    main()
