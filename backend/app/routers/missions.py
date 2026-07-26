from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.missions import JourneyOut, MissionListOut, MissionOut
from app.services import missions
from app.services.security import get_current_user

router = APIRouter(prefix="/api", tags=["missions"])


@router.get("/missions", response_model=MissionListOut)
def get_missions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now, _ = missions.user_now(db, user.id)
    daily = missions.assignments_for(db, user.id, "daily")
    weekly = missions.assignments_for(db, user.id, "weekly")
    db.commit()
    return {"effective_date": now.date().isoformat(), "daily": daily, "weekly": weekly}


@router.post("/missions/{assignment_id}/reroll", response_model=MissionOut)
def reroll(assignment_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        assignment = missions.reroll(db, user.id, assignment_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Mission not found")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit(); db.refresh(assignment)
    return assignment


@router.get("/journey/week", response_model=JourneyOut)
def week_journey(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return missions.journey(db, user.id)
