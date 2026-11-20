"""Write the 3 newest regular YouTube uploads (no Shorts) to data/youtube.json.

YouTube keeps a hidden "videos only" playlist per channel: the channel ID with the
leading "UC" replaced by "UULF". Its feed contains no Shorts and no live streams.
"""
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CHANNEL_ID = "UC-6zSmuerT4LvwzCy7MLNFA"
PLAYLIST_ID = "UULF" + CHANNEL_ID[2:]
FEED = f"https://www.youtube.com/feeds/videos.xml?playlist_id={PLAYLIST_ID}"
OUT = Path(__file__).resolve().parent.parent / "data" / "youtube.json"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def main():
    req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    videos = []
    for e in root.findall("a:entry", NS)[:3]:
        videos.append({
            "id": e.findtext("yt:videoId", namespaces=NS),
            "title": e.findtext("a:title", namespaces=NS),
            "published": e.findtext("a:published", namespaces=NS),
        })
    if not videos:
        print("Feed returned no videos; keeping the existing file.", file=sys.stderr)
        sys.exit(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"videos": videos}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(videos)} videos.")


if __name__ == "__main__":
    main()
