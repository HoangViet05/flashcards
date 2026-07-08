from datetime import date, datetime
import re

from pydantic import BaseModel, Field, field_validator


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")


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
    reminder_enabled: bool
    reminder_time: str
    timezone: str
    last_reminder_sent_on: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ReminderSettingsUpdate(BaseModel):
    reminder_enabled: bool
    reminder_time: str = "08:00"
    timezone: str = Field(default="Asia/Saigon", max_length=64)

    @field_validator("reminder_time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        if not TIME_RE.match(value):
            raise ValueError("Reminder time must use HH:MM format")
        hour, minute = [int(part) for part in value.split(":")]
        if hour > 23 or minute > 59:
            raise ValueError("Reminder time must be a valid 24-hour time")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        timezone = value.strip()
        if not timezone:
            raise ValueError("Timezone is required")
        return timezone


class ReminderSendResult(BaseModel):
    checked_users: int
    sent: int
    skipped: int
    due_cards: int
    message: str
