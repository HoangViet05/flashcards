from email.message import EmailMessage
import smtplib

from app.config import get_settings


def smtp_is_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_study_reminder_email(to_email: str, due_cards: int) -> None:
    settings = get_settings()
    if not smtp_is_configured():
        raise RuntimeError("SMTP is not configured")

    subject = "Nhắc học Flashcards hôm nay"
    card_word = "thẻ" if due_cards != 1 else "thẻ"
    body = (
        f"Chào bạn,\n\n"
        f"Hôm nay bạn có {due_cards} {card_word} cần ôn tập trên Flashie.\n"
        f"Mở app để học ngay: {settings.frontend_url}/review\n\n"
        "Bạn có thể tắt hoặc đổi giờ nhắc trong trang Tài khoản."
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
