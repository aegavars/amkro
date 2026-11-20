"""Send a Discord reminder when a race from data/events.json starts within 50 minutes.

Ported from the WSS bot. Reads the webhook from the environment (GitHub Secret):
    DISCORD_WEBHOOK_URL
Remembers what it already announced in data/sent_alerts.json.
Set DRY_RUN=1 to print instead of sending.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
EVENTS = ROOT / "data" / "events.json"
STATE = ROOT / "data" / "sent_alerts.json"
TZ = ZoneInfo("Europe/Berlin")
WINDOW_SECONDS = 3000  # 50 minutes


def load_state():
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return []


def send(webhook, title, url, img, when_text, minutes_left):
    embed = {
        "title": title,
        "url": url,
        "description": f"⏰ **Race starting soon! (~{int(minutes_left)} mins remaining)** ⏰",
        "color": 15258703,
        "fields": [{"name": "Scheduled Start Time", "value": when_text, "inline": True}],
    }
    if img:
        embed["image"] = {"url": img}
    payload = {"content": "**AMKRO RACE REMINDER**", "embeds": [embed]}
    if os.environ.get("DRY_RUN"):
        print("DRY RUN:", json.dumps(payload, ensure_ascii=False))
        return True
    req = urllib.request.Request(webhook, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "amkro-site"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status in (200, 204)
    except Exception as e:
        print(f"Discord request failed: {e}", file=sys.stderr)
        return False


def main():
    webhook = os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook and not os.environ.get("DRY_RUN"):
        print("DISCORD_WEBHOOK_URL not set; skipping alerts.")
        return
    try:
        events = json.loads(EVENTS.read_text(encoding="utf-8")).get("events", [])
    except Exception as e:
        print(f"Could not read events.json: {e}", file=sys.stderr)
        return

    sent = load_state()
    now = datetime.now(timezone.utc)
    changed = False
    for e in events:
        try:
            start = datetime.fromisoformat(e["start"]).astimezone(timezone.utc)
        except Exception:
            continue
        left = (start - now).total_seconds()
        if not 0 <= left <= WINDOW_SECONDS:
            continue
        key = e["url"]
        if key in sent:
            print(f"Already announced: {e['name']}")
            continue
        local = start.astimezone(TZ)
        when_text = f"{local.strftime('%d %b %H:%M').upper()} {local.strftime('%Z')} (UTC{local.strftime('%z')[:3]}:{local.strftime('%z')[3:]})"
        if send(webhook, e["name"], e["url"], e.get("thumbnail"), when_text, round(left / 60, 1)):
            sent.append(key)
            changed = True
            print(f"Announced: {e['name']}")
    if changed and not os.environ.get("DRY_RUN"):
        STATE.write_text(json.dumps(sent[-200:], indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
