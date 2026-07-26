"""Extract VOA Learning English Word Book entries from a PDF into plain text."""
import argparse
import re
from pathlib import Path

ENTRY_RE = re.compile(
    r"^([a-z][a-z']{1,24})\s*[–—-]\s*(?:n|v|ad|adj|adv|prep|conj|pron|art)\.",
    re.MULTILINE,
)


def parse_core_words(text: str) -> set[str]:
    return {match.group(1) for match in ENTRY_RE.finditer(text.lower())}


def read_pdf(path: Path) -> str:
    import fitz

    document = fitz.open(path)
    try:
        return "\n".join(page.get_text("text") for page in document)
    finally:
        document.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    words = sorted(parse_core_words(read_pdf(args.pdf)))
    if len(words) < 1000:
        raise SystemExit(f"Only extracted {len(words)} words; PDF layout or parser likely changed.")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(words) + "\n", encoding="utf-8")
    print(f"Wrote {len(words)} words to {args.out}")


if __name__ == "__main__":
    main()
