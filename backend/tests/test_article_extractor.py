import fitz
import pytest

from app.services.article_extractor import ExtractionError, count_words, extract_from_html, extract_from_pdf_source, normalize_text


def test_extract_html_and_normalize():
    title, text = extract_from_html("<html><head><title>Docker Explained</title></head><body><article><p>Docker is a platform for building and running containers.</p><p>Containers are portable across environments for teams.</p></article><footer>Copyright</footer></body></html>", "fallback")
    assert title == "Docker Explained"
    assert "platform for building" in text
    assert count_words("one two three") == 3
    assert "\n\n\n" not in normalize_text("one\n\n\n\ntwo")
    with pytest.raises(ExtractionError):
        extract_from_html("<html><body></body></html>", "x")


def test_normalize_text_removes_standalone_transcript_timestamps():
    text = "**00:00**\n**Hi.**\n00:06\nThis is a talk.\n1:02:03\nFinal sentence."
    assert normalize_text(text) == "**Hi.**\nThis is a talk.\nFinal sentence."


def test_extract_pdf(tmp_path):
    path = tmp_path / "sample.pdf"; document = fitz.open(); page = document.new_page(); page.insert_text((72, 72), "Kubernetes orchestrates containers at scale."); document.save(str(path)); document.close()
    assert "Kubernetes orchestrates" in extract_from_pdf_source(str(path))
