"""Harvest open-licensed articles for the catalog; runtime never calls this script."""
import argparse
import json
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from app.services.article_extractor import ExtractionError, count_words, extract_from_html, fetch_url, normalize_text
from app.services.readability import SENTENCE_SPLIT_RE, WORD_RE, level_for, score
from app.services.word_picker import pick_words

VOA_FEED_BASE = "https://learningenglish.voanews.com/api/"
VOA_FEEDS = {
    "As It Is": "zkm-ql-vomx-tpej-rqi",
    "Health & Lifestyle": "zmmpql-vomx-tpey-_q",
    "Science & Technology": "zmg_pl-vomx-tpeymtm",
    "American Stories": "zyg__l-vomx-tpetmty",
    "Words and Their Stories": "zmypyl-vomx-tpeyry_",
    "America's Presidents": "zjypq_l-vomx-tpebryqy",
    "U.S. History": "zj_pvl-vomx-tpebb_v",
    "Arts & Culture": "zpyp_l-vomx-tpe_rym",
}
SIMPLEWIKI_API = "https://simple.wikipedia.org/w/api.php"
SIMPLEWIKI_TOPICS = ["Volcano", "Sun", "Elephant", "Rain", "Bicycle", "Bread", "Coffee", "Football", "Music", "Rainbow", "Desert", "Honey bee", "Moon", "River", "Sleep", "Tea", "Tiger", "Train", "Vitamin", "Weather"]
USER_AGENT = "FlashcardsReader/1.0 (nhoangviet1905@gmail.com)"
MIN_WORDS, MIN_SENTENCES = 150, 5


@dataclass
class FeedItem:
    title: str
    link: str
    published_at: datetime | None
    audio_url: str | None


def parse_feed(xml: str) -> list[FeedItem]:
    root = ET.fromstring(xml)
    items: list[FeedItem] = []
    for node in root.findall("./channel/item"):
        link = (node.findtext("link") or "").strip()
        if not link:
            continue
        try:
            published_at = parsedate_to_datetime(node.findtext("pubDate") or "").replace(tzinfo=None)
        except (TypeError, ValueError):
            published_at = None
        enclosure = node.find("enclosure")
        items.append(FeedItem((node.findtext("title") or "").strip(), link, published_at, enclosure.get("url") if enclosure is not None else None))
    return items


def is_usable(text: str) -> bool:
    if count_words(text) < MIN_WORDS:
        return False
    return len([part for part in SENTENCE_SPLIT_RE.split(text) if WORD_RE.search(part)]) >= MIN_SENTENCES


def build_record(*, source: str, source_url: str, title: str, content: str, license: str, attribution: str, audio_url: str | None, published_at: datetime | None) -> dict:
    return {
        "source": source, "source_url": source_url, "title": title[:500], "content": content,
        "word_count": count_words(content), "difficulty_score": score(content), "level": level_for(content),
        "suggested_words": pick_words(content), "license": license, "attribution": attribution[:500],
        "audio_url": audio_url, "published_at": published_at.isoformat() if published_at else None,
    }


def harvest_voa(per_feed: int) -> list[dict]:
    records: list[dict] = []
    for program, feed_id in VOA_FEEDS.items():
        try:
            response = httpx.get(VOA_FEED_BASE + feed_id, headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True)
            response.raise_for_status()
            items = parse_feed(response.text)
        except (httpx.HTTPError, ET.ParseError) as exc:
            print(f"  ! Skip feed {program}: {exc}")
            continue
        kept = 0
        for item in items:
            if kept >= per_feed:
                break
            try:
                _, text = extract_from_html(fetch_url(item.link), item.title)
            except ExtractionError as exc:
                print(f"  - Skip {item.link}: {exc}")
                continue
            if not is_usable(text):
                print(f"  - Skip {item.link}: unusable body ({count_words(text)} words)")
                continue
            records.append(build_record(source="voa", source_url=item.link, title=item.title, content=text, license="public-domain", attribution=f"VOA Learning English — {program} (public domain)", audio_url=item.audio_url, published_at=item.published_at))
            kept += 1
            time.sleep(0.5)
        print(f"  {program}: {kept} articles")
    return records


def harvest_simplewiki() -> list[dict]:
    records: list[dict] = []
    for topic in SIMPLEWIKI_TOPICS:
        try:
            response = httpx.get(SIMPLEWIKI_API, params={"action": "query", "prop": "extracts", "explaintext": "1", "format": "json", "titles": topic}, headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True)
            response.raise_for_status()
            page = next(iter(response.json()["query"]["pages"].values()))
        except (httpx.HTTPError, KeyError, ValueError, StopIteration) as exc:
            print(f"  ! Skip {topic}: {exc}")
            continue
        text = normalize_text(page.get("extract") or "")
        if not is_usable(text):
            print(f"  - Skip {topic}: unusable body")
            continue
        title = page.get("title") or topic
        records.append(build_record(source="simplewiki", source_url=f"https://simple.wikipedia.org/wiki/{topic.replace(' ', '_')}", title=title, content=text, license="cc-by-sa-4.0", attribution=f"Simple English Wikipedia — “{title}”, CC BY-SA 4.0", audio_url=None, published_at=None))
        print(f"  {topic}: ok")
        time.sleep(0.5)
    return records


def push(records: list[dict], api_base: str, token: str) -> None:
    response = httpx.post(api_base.rstrip("/") + "/api/catalog/ingest", json={"articles": records}, headers={"X-Catalog-Token": token}, timeout=120)
    response.raise_for_status()
    print(f"Pushed: {response.json()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=("voa", "simplewiki"), required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--api-base")
    parser.add_argument("--token")
    parser.add_argument("--per-feed", type=int, default=6)
    args = parser.parse_args()
    if not args.out and not args.push:
        raise SystemExit("Provide --out or --push")
    if args.push and not (args.api_base and args.token):
        raise SystemExit("--push requires --api-base and --token")
    records = harvest_voa(args.per_feed) if args.source == "voa" else harvest_simplewiki()
    print(f"Total: {len(records)} articles")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.push:
        push(records, args.api_base, args.token)


if __name__ == "__main__":
    main()
