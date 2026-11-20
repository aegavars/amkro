#!/usr/bin/env python3
"""Fetch all finished events and Top 3 podium standings for AMKRO on World Sim Series."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ORG_ID = "2b746de0d67e2930b18aacfa19e07eeb"
ORG_URL = f"https://paddock.worldsimseries.com/organizations/{ORG_ID}"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "standings.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": ORG_URL,
    "Origin": "https://paddock.worldsimseries.com",
}


def fetch_json(url: str) -> Any | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except Exception:
        return None


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def country_to_flag(code: str | None) -> str:
    if not code:
        return ""
    clean = re.sub(r"[^A-Za-z]", "", str(code)).upper()
    if len(clean) == 3:
        alpha3_to_2 = {
            "LVA": "LV", "LTU": "LT", "EST": "EE", "DEU": "DE", "GER": "DE",
            "GBR": "GB", "ENG": "GB", "USA": "US", "FRA": "FR", "ITA": "IT",
            "ESP": "ES", "NLD": "NL", "BEL": "BE", "POL": "PL", "FIN": "FI",
            "SWE": "SE", "NOR": "NO", "DNK": "DK", "AUT": "AT", "CHE": "CH",
            "CZE": "CZ", "SVK": "SK", "HUN": "HU", "ROU": "RO", "BGR": "BG",
            "UKR": "UA", "PRT": "PT", "IRL": "IE", "AUS": "AU", "NZL": "NZ",
            "CAN": "CA", "BRA": "BR", "ARG": "AR", "JPN": "JP", "KOR": "KR",
        }
        clean = alpha3_to_2.get(clean, clean[:2])
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
    first_initial = parts[0][0].upper()
    surname = " ".join(parts[1:])
    return f"{first_initial}. {surname}"


def extract_events_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ("events", "items", "data", "results", "finishedEvents", "finished"):
            val = payload.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
    return []


def fetch_org_finished_events() -> list[dict[str, Any]]:
    candidate_urls = [
        f"https://paddock.worldsimseries.com/api/organizations/{ORG_ID}/events?status=finished&limit=100",
        f"https://paddock.worldsimseries.com/api/organizations/{ORG_ID}/finished-events?limit=100",
        f"https://paddock.worldsimseries.com/api/organizations/{ORG_ID}/events?limit=100",
        f"https://paddock.worldsimseries.com/api/v1/organizations/{ORG_ID}/events?status=finished",
        f"https://api.worldsimseries.com/organizations/{ORG_ID}/events?status=finished",
    ]
    for url in candidate_urls:
        data = fetch_json(url)
        items = extract_events_list(data)
        if items:
            return items

    # Fallback: parse embedded JSON state from the organization page HTML
    html = fetch_text(ORG_URL)
    for m in re.finditer(r"<script[^>]*>(\{.*?\})</script>", html, flags=re.S):
        try:
            blob = json.loads(m.group(1))
            items = extract_events_list(blob)
            if items:
                return items
        except Exception:
            continue
    return []


def extract_rows_from_standings(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ("standings", "drivers", "entries", "rows", "results", "classification", "items", "data"):
            val = payload.get(key)
            if isinstance(val, list) and val and isinstance(val[0], dict):
                return val
            if isinstance(val, dict):
                nested = extract_rows_from_standings(val)
                if nested:
                    return nested
    return []


def fetch_event_top3(event_id: str | int) -> list[dict[str, Any]]:
    eid = str(event_id)
    candidate_urls = [
        f"https://paddock.worldsimseries.com/api/events/{eid}/standings",
        f"https://paddock.worldsimseries.com/api/events/{eid}/results",
        f"https://paddock.worldsimseries.com/api/v1/events/{eid}/standings",
        f"https://api.worldsimseries.com/events/{eid}/standings",
    ]
    rows: list[dict[str, Any]] = []
    for url in candidate_urls:
        data = fetch_json(url)
        rows = extract_rows_from_standings(data)
        if rows:
            break

    top3: list[dict[str, Any]] = []
    for idx, row in enumerate(rows[:3], start=1):
        driver = row.get("driver") if isinstance(row.get("driver"), dict) else {}
        user = row.get("user") if isinstance(row.get("user"), dict) else {}

        raw_name = (
            row.get("driverName")
            or row.get("fullName")
            or row.get("name")
            or driver.get("fullName")
            or driver.get("name")
            or (f"{driver.get('firstName', '')} {driver.get('lastName', '')}".strip())
            or (f"{user.get('firstName', '')} {user.get('lastName', '')}".strip())
            or user.get("name")
            or ""
        )
        country_code = (
            row.get("countryCode")
            or row.get("country")
            or row.get("nationality")
            or driver.get("countryCode")
            or driver.get("country")
            or user.get("countryCode")
            or user.get("country")
            or ""
        )
        points = row.get("points") if row.get("points") is not None else row.get("score")
        pos = row.get("position") or row.get("pos") or row.get("rank") or idx

        top3.append(
            {
                "position": int(pos) if str(pos).isdigit() else idx,
                "name": format_short_name(raw_name),
                "fullName": str(raw_name).strip(),
                "countryCode": str(country_code).upper(),
                "flag": country_to_flag(country_code),
                "points": points,
            }
        )
    return top3


def is_finished_event(ev: dict[str, Any]) -> bool:
    status = str(ev.get("status") or ev.get("state") or "").lower()
    if status in {"finished", "completed", "ended", "past", "archived"}:
        return True
    end_str = ev.get("endDate") or ev.get("endsAt") or ev.get("end") or ev.get("startDate") or ev.get("startsAt")
    if end_str:
        try:
            dt = datetime.fromisoformat(str(end_str).replace("Z", "+00:00"))
            return dt < datetime.now(timezone.utc)
        except Exception:
            pass
    return True


def normalize_event(ev: dict[str, Any]) -> dict[str, Any] | None:
    eid = ev.get("id") or ev.get("eventId") or ev.get("slug")
    if not eid:
        return None
    eid_str = str(eid)
    name = str(ev.get("name") or ev.get("title") or f"Event {eid_str}").strip()
    series = str(
        (ev.get("series") or {}).get("name")
        if isinstance(ev.get("series"), dict)
        else (ev.get("seriesName") or ev.get("series") or "")
    ).strip()

    thumb = (
        ev.get("bannerUrl")
        or ev.get("banner")
        or ev.get("thumbnailUrl")
        or ev.get("thumbnail")
        or ev.get("imageUrl")
        or ev.get("image")
        or ""
    )
    if thumb and str(thumb).startswith("/"):
        thumb = "https://paddock.worldsimseries.com" + str(thumb)

    raw_date = ev.get("endDate") or ev.get("startDate") or ev.get("startsAt") or ev.get("date") or ""
    date_label = ""
    sort_ts = ""
    if raw_date:
        sort_ts = str(raw_date)
        try:
            dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
            date_label = dt.strftime("%d %b %Y")
        except Exception:
            date_label = str(raw_date)[:10]

    top3 = fetch_event_top3(eid_str)

    return {
        "id": eid_str,
        "name": name,
        "series": series,
        "status": "finished",
        "date": date_label,
        "sortDate": sort_ts,
        "thumbnail": str(thumb),
        "url": f"https://paddock.worldsimseries.com/events/{eid_str}#/",
        "standingsUrl": f"https://paddock.worldsimseries.com/events/{eid_str}/standings#/",
        "top3": top3,
    }


def main() -> None:
    raw_events = fetch_org_finished_events()
    existing: list[dict[str, Any]] = []
    if OUT_PATH.exists():
        try:
            old = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            existing = old.get("events") or []
        except Exception:
            existing = []

    normalized: list[dict[str, Any]] = []
    for ev in raw_events:
        if not is_finished_event(ev):
            continue
        item = normalize_event(ev)
        if item:
            normalized.append(item)

    if normalized:
        normalized.sort(key=lambda x: x.get("sortDate", ""), reverse=True)
        events_out = normalized
    else:
        # Preserve existing events and refresh their Top 3 if API returned empty
        events_out = existing
        for item in events_out:
            item["status"] = "finished"
            if item.get("id"):
                fresh_top3 = fetch_event_top3(item["id"])
                if fresh_top3:
                    item["top3"] = fresh_top3
                item["standingsUrl"] = f"https://paddock.worldsimseries.com/events/{item['id']}/standings#/"

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "organizationUrl": f"{ORG_URL}#/finished-events",
        "events": events_out,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(events_out)} finished events to {OUT_PATH}")


if __name__ == "__main__":
    main()
