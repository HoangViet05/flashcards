from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./flashcards.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str | None = None
    auth_secret: str = "change-me-in-production"
    auth_token_expire_days: int = 30
    app_data_dir: Path = Path("data")
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str | None = None
    supabase_storage_prefix: str = "flashcards"

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def data_dir(self) -> Path:
        return self.app_data_dir

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def supabase_storage_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key and self.supabase_storage_bucket)


@lru_cache
def get_settings() -> Settings:
    return Settings()
