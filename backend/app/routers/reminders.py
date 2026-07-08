from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.auth import ReminderSendResult
from app.services.email_service import send_study_reminder_email, smtp_is_configured


router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _local_today_if_ready(user: User) -> date | None:
    try:
        user_timezone = ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        user_timezone = timezone.utc

    local_now = datetime.now(timezone.utc).astimezone(user_timezone)
    local_today = local_now.date()
    if user.last_reminder_sent_on and user.last_reminder_sent_on >= local_today:
        return None
    if local_now.strftime("%H:%M") < user.reminder_time:
        return None
    return local_today


@router.post("/send-daily", response_model=ReminderSendResult)
def send_daily_reminders(
    x_reminder_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.reminder_cron_secret and x_reminder_secret != settings.reminder_cron_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reminder secret")

    today = date.today()
    due_cards = db.query(Review).filter(Review.due_date <= today).count()
    users = db.query(User).filter(User.reminder_enabled.is_(True)).all()

    if due_cards == 0:
        return ReminderSendResult(
            checked_users=len(users),
            sent=0,
            skipped=len(users),
            due_cards=0,
            message="No cards are due today",
        )

    sent = 0
    skipped = 0
    configured = smtp_is_configured()

    for user in users:
        local_today = _local_today_if_ready(user)
        if local_today is None:
            skipped += 1
            continue
        if not configured:
            skipped += 1
            continue
        try:
            send_study_reminder_email(user.email, due_cards)
        except Exception:
            skipped += 1
            continue
        user.last_reminder_sent_on = local_today
        sent += 1

    if sent:
        db.commit()

    message = "Reminders sent" if configured else "SMTP is not configured"
    return ReminderSendResult(
        checked_users=len(users),
        sent=sent,
        skipped=skipped,
        due_cards=due_cards,
        message=message,
    )
