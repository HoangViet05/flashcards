from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.progress import CalendarDay, EventBatchIn, EventBatchOut, EventResult, ProgressOverview
from app.services import missions, progression
from app.services.security import get_current_user

router = APIRouter(prefix="/api", tags=["progression"])


@router.post("/events/batch", response_model=EventBatchOut)
def batch_events(body: EventBatchIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    results = []; updates = []
    for event_data in body.events:
        _, xp, duplicate = progression.apply_event(db, user.id, event_data)
        if not duplicate:
            updates.extend(missions.apply_event_to_missions(db, user.id, event_data))
        results.append(EventResult(idempotency_key=event_data.idempotency_key, accepted=True, duplicate=duplicate, xp_awarded=xp, skill=event_data.skill))
    db.commit()
    return EventBatchOut(events=results, xp_awarded=sum(item.xp_awarded for item in results), mission_updates=list(dict.fromkeys(updates)))


@router.get("/progress/calendar", response_model=list[CalendarDay])
def calendar(days: int = Query(default=84, ge=7, le=365), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return progression.calendar_data(db, user.id, days)


@router.get("/progress/overview", response_model=ProgressOverview)
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = progression.overview_data(db, user.id)
    db.commit()
    return data
