"""Lazy faster-whisper singleton with CUDA then CPU fallback."""

import importlib.util
import logging
import os
import threading

log = logging.getLogger("shadowing-worker")
MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
_lock = threading.Lock()
_model = None
_device: str | None = None


def is_loaded() -> bool:
    return _model is not None


def get_device() -> str | None:
    return _device


def _add_cuda_dll_dirs() -> None:
    for module in ("nvidia.cublas", "nvidia.cudnn"):
        spec = importlib.util.find_spec(module)
        for location in list(spec.submodule_search_locations or []) if spec else []:
            directory = os.path.join(location, "bin")
            if os.path.isdir(directory):
                os.add_dll_directory(directory)


def _load() -> None:
    global _model, _device
    from faster_whisper import WhisperModel
    try:
        _add_cuda_dll_dirs()
        _model, _device = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16"), "cuda"
    except Exception as exc:
        log.warning("Không dùng được CUDA (%s) — chuyển sang CPU int8", exc)
        _model, _device = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8"), "cpu"


def transcribe(audio_path: str) -> str:
    with _lock:
        if _model is None:
            _load()
    segments, _info = _model.transcribe(audio_path, language="en", vad_filter=True, beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()
