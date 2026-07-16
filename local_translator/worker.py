"""GPU worker that pulls queued Reader articles and translates them locally.

It never accepts inbound traffic.  While this process is running it polls the
cloud API, claims one job at a time, translates it, then saves the result.
Close the console (or press Ctrl+C) to turn the worker off.
"""

import logging
import os
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "")
MODEL_ID = os.getenv("MODEL_ID", "vinai/vinai-translate-en2vi-v2")
POLL_SECONDS = max(2, int(os.getenv("POLL_SECONDS", "6")))
BATCH_SIZE = max(1, int(os.getenv("BATCH_SIZE", "4")))
MAX_INPUT_TOKENS = max(128, int(os.getenv("MAX_INPUT_TOKENS", "384")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("flashcards-local-translator")


def split_into_segments(text: str, limit: int = 1000) -> list[str]:
    """Split long text at sentence boundaries, retaining context-sized chunks."""
    segments: list[str] = []
    for paragraph in re.split(r"\n\s*\n", text.strip()):
        paragraph = " ".join(paragraph.split())
        if not paragraph:
            continue
        sentences = re.split(r"(?<=[.!?])\s+(?=[\"'A-Z0-9])", paragraph)
        buffer = ""
        for sentence in sentences:
            if buffer and len(buffer) + len(sentence) + 1 > limit:
                segments.append(buffer)
                buffer = sentence
            else:
                buffer = f"{buffer} {sentence}".strip()
        if buffer:
            segments.append(buffer)
    return segments or [text.strip()]


class Translator:
    def __init__(self) -> None:
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        if not torch.cuda.is_available():
            raise RuntimeError(
                "Không tìm thấy CUDA GPU. Hãy cài PyTorch bản CUDA rồi chạy lại; worker không dùng CPU để tránh làm chậm máy."
            )
        self.torch = torch
        self.device = "cuda"
        log.info("Đang tải model %s lên GPU… (chỉ xảy ra khi có bài đầu tiên)", MODEL_ID)
        # VinAI Translate is mBART based. Both the input language and the
        # decoder's first language token are required for stable output.
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, src_lang="en_XX")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, torch_dtype=torch.float16)
        self.model.to(self.device).eval()
        self._loaded = True
        log.info("Model đã sẵn sàng trên %s: %s", torch.cuda.get_device_name(0), MODEL_ID)

    def translate(self, content: str) -> tuple[str, list[dict[str, str]]]:
        self._load()
        source_segments = split_into_segments(content)
        translated_segments: list[str] = []
        for offset in range(0, len(source_segments), BATCH_SIZE):
            batch = source_segments[offset: offset + BATCH_SIZE]
            encoded = self.tokenizer(
                batch,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=MAX_INPUT_TOKENS,
            ).to(self.device)
            with self.torch.inference_mode():
                output = self.model.generate(
                    **encoded,
                    decoder_start_token_id=self.tokenizer.lang_code_to_id["vi_VN"],
                    num_beams=5,
                    max_new_tokens=MAX_INPUT_TOKENS,
                    no_repeat_ngram_size=3,
                    early_stopping=True,
                )
            translated_segments.extend(self.tokenizer.batch_decode(output, skip_special_tokens=True))
        segments = [
            {"source": source, "translated": translated.strip()}
            for source, translated in zip(source_segments, translated_segments, strict=True)
            if translated.strip()
        ]
        if not segments:
            raise RuntimeError("Model không trả về bản dịch")
        for item in segments:
            # Refuse mBART's known repetition failure mode instead of saving it.
            if re.search(r"\b(\w+)(?:\s+\1){5,}\b", item["translated"], flags=re.IGNORECASE):
                raise RuntimeError("Model sinh bản dịch lặp bất thường; bài này chưa được lưu")
        return "\n\n".join(item["translated"] for item in segments), segments


def require_configuration() -> None:
    missing = [name for name, value in (("API_BASE_URL", API_BASE_URL), ("WORKER_TOKEN", WORKER_TOKEN)) if not value]
    if missing:
        raise RuntimeError(f"Thiếu {', '.join(missing)} trong local_translator/.env")


def main() -> None:
    require_configuration()
    session = requests.Session()
    session.headers["X-Translation-Worker-Token"] = WORKER_TOKEN
    translator = Translator()
    claim_url = f"{API_BASE_URL}/articles/local-translation/claim"
    log.info("Công tắc dịch đang BẬT. Chờ bài từ %s", API_BASE_URL)
    try:
        while True:
            try:
                response = session.post(claim_url, timeout=20)
                if response.status_code == 204:
                    time.sleep(POLL_SECONDS)
                    continue
                response.raise_for_status()
                job = response.json()
                log.info("Nhận bài: %s", job["title"])
                try:
                    translated_content, segments = translator.translate(job["content"])
                    complete = session.post(
                        f"{API_BASE_URL}/articles/local-translation/{job['id']}/complete",
                        json={"translated_content": translated_content, "segments": segments},
                        timeout=60,
                    )
                    complete.raise_for_status()
                    log.info("Đã dịch xong: %s (%s đoạn)", job["title"], len(segments))
                except Exception as exc:  # The job is preserved as failed for a later retry.
                    log.exception("Dịch lỗi: %s", exc)
                    session.post(
                        f"{API_BASE_URL}/articles/local-translation/{job['id']}/fail",
                        json={"error_message": str(exc)[:2000]},
                        timeout=20,
                    )
            except requests.HTTPError as exc:
                if exc.response is not None and exc.response.status_code == 401:
                    raise RuntimeError("Mã WORKER_TOKEN không hợp lệ hoặc đã bị thu hồi") from exc
                log.warning("Lỗi kết nối server: %s. Thử lại sau %s giây.", exc, POLL_SECONDS)
                time.sleep(POLL_SECONDS)
            except requests.RequestException as exc:
                log.warning("Không kết nối được server: %s. Thử lại sau %s giây.", exc, POLL_SECONDS)
                time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        log.info("Công tắc dịch đã TẮT.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log.error("Worker không thể khởi động: %s", exc)
        sys.exit(1)
