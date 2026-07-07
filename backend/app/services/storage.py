from pathlib import Path
from urllib.parse import quote

import httpx

from app.config import get_settings


def storage_enabled() -> bool:
    return get_settings().supabase_storage_enabled


def _clean_part(value: str) -> str:
    cleaned = value.strip().strip("/").replace("\\", "/")
    return "/".join(part for part in cleaned.split("/") if part and part not in {".", ".."})


def _object_path(folder: str, filename: str) -> str:
    settings = get_settings()
    prefix = _clean_part(settings.supabase_storage_prefix)
    folder = _clean_part(folder)
    name = Path(filename).name
    return "/".join(part for part in [prefix, folder, name] if part)


def _encoded_path(path: str) -> str:
    return "/".join(quote(part, safe="") for part in path.split("/"))


def _storage_base_url() -> str:
    return (get_settings().supabase_url or "").rstrip("/")


def public_url(path: str) -> str:
    settings = get_settings()
    bucket = quote(settings.supabase_storage_bucket or "", safe="")
    return f"{_storage_base_url()}/storage/v1/object/public/{bucket}/{_encoded_path(path)}"


def upload_public_file(folder: str, filename: str, data: bytes, content_type: str) -> str:
    settings = get_settings()
    if not settings.supabase_storage_enabled:
        raise RuntimeError("Supabase storage is not configured")

    bucket = quote(settings.supabase_storage_bucket or "", safe="")
    path = _object_path(folder, filename)
    url = f"{_storage_base_url()}/storage/v1/object/{bucket}/{_encoded_path(path)}"
    headers = {
        "apikey": settings.supabase_service_role_key or "",
        "authorization": f"Bearer {settings.supabase_service_role_key}",
        "content-type": content_type,
        "x-upsert": "true",
    }
    response = httpx.post(url, content=data, headers=headers, timeout=30)
    response.raise_for_status()
    return public_url(path)


def delete_public_file_url(file_url: str) -> None:
    settings = get_settings()
    if not settings.supabase_storage_enabled:
        return

    public_prefix = public_url("").rstrip("/")
    if not file_url.startswith(public_prefix):
        return

    path = file_url.removeprefix(public_prefix).strip("/")
    bucket = quote(settings.supabase_storage_bucket or "", safe="")
    url = f"{_storage_base_url()}/storage/v1/object/{bucket}"
    headers = {
        "apikey": settings.supabase_service_role_key or "",
        "authorization": f"Bearer {settings.supabase_service_role_key}",
        "content-type": "application/json",
    }
    response = httpx.request("DELETE", url, json={"prefixes": [path]}, headers=headers, timeout=30)
    response.raise_for_status()
