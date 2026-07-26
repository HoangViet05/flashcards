from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.boss import BossCompleteIn, BossCompleteOut, BossCurrentOut
from app.services import boss
from app.services.security import get_current_user

router = APIRouter(prefix="/api/boss", tags=["boss"])


@router.get("/current", response_model=BossCurrentOut)
def current(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return boss.current(db, user.id)


@router.post("/complete", response_model=BossCompleteOut)
def complete(body: BossCompleteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = boss.complete(db, user.id, body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    return result
