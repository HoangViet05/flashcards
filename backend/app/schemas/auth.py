from datetime import datetime
import re

from pydantic import BaseModel, Field, field_validator


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_RE.match(email):
            raise ValueError("Email is not valid")
        return email


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    preferred_level: int | None = None
    created_at: datetime
    preferences: "UserPreferenceOut | None" = None

    model_config = {"from_attributes": True}


class SilentProfile(BaseModel):
    music_enabled: bool = False
    sfx_enabled: bool = False
    feedback_enabled: bool = False
    pronunciation_enabled: bool = False
    haptic_enabled: bool = False


class UserPreferenceOut(BaseModel):
    ui_theme: str
    accent_theme: str
    reduce_effects: bool
    daily_goal_minutes: int
    timezone: str
    work_goal: str
    preferred_voice_name: str | None
    preferred_voice_locale: str | None
    speech_rate: float
    music_enabled: bool
    sfx_enabled: bool
    feedback_enabled: bool
    pronunciation_enabled: bool
    haptic_enabled: bool
    master_volume: float
    music_volume: float
    sfx_volume: float
    feedback_volume: float
    pronunciation_volume: float
    silent_mode: bool
    silent_profile: SilentProfile
    onboarding_completed_at: datetime | None

    model_config = {"from_attributes": True}


class PreferencesUpdate(BaseModel):
    preferred_level: int | None = Field(default=None, ge=1, le=3)
    ui_theme: str | None = None
    accent_theme: str | None = None
    reduce_effects: bool | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=5, le=120)
    timezone: str | None = Field(default=None, max_length=64)
    work_goal: str | None = None
    preferred_voice_name: str | None = Field(default=None, max_length=255)
    preferred_voice_locale: str | None = Field(default=None, max_length=16)
    speech_rate: float | None = Field(default=None, ge=0.7, le=1.3)
    music_enabled: bool | None = None
    sfx_enabled: bool | None = None
    feedback_enabled: bool | None = None
    pronunciation_enabled: bool | None = None
    haptic_enabled: bool | None = None
    master_volume: float | None = Field(default=None, ge=0, le=1)
    music_volume: float | None = Field(default=None, ge=0, le=1)
    sfx_volume: float | None = Field(default=None, ge=0, le=1)
    feedback_volume: float | None = Field(default=None, ge=0, le=1)
    pronunciation_volume: float | None = Field(default=None, ge=0, le=1)
    silent_mode: bool | None = None
    silent_profile: SilentProfile | None = None
    onboarding_completed: bool | None = None

    @field_validator("ui_theme")
    @classmethod
    def valid_theme(cls, value: str | None) -> str | None:
        if value is not None and value not in {"system", "light", "dark"}:
            raise ValueError("Theme is not valid")
        return value

    @field_validator("accent_theme")
    @classmethod
    def valid_accent(cls, value: str | None) -> str | None:
        if value is not None and value not in {"violet-cyan", "blue-emerald", "amber-rose", "graphite-ice"}:
            raise ValueError("Accent is not valid")
        return value

    @field_validator("work_goal")
    @classmethod
    def valid_goal(cls, value: str | None) -> str | None:
        if value is not None and value not in {"reading", "listening", "conversation", "balanced"}:
            raise ValueError("Work goal is not valid")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        if value is not None:
            from zoneinfo import ZoneInfo
            try:
                ZoneInfo(value)
            except Exception as exc:
                raise ValueError("Timezone is not valid") from exc
        return value


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
