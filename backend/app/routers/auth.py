from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.auth import AuthToken, LoginRequest, PreferencesUpdate, RegisterRequest, UserOut, UserPreferenceOut
from app.services.catalog import seed_first_article
from app.services.security import create_access_token, get_current_user, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _preference(db: Session, user_id: str) -> UserPreference:
    preference = db.get(UserPreference, user_id)
    if preference is None:
        preference = UserPreference(user_id=user_id)
        db.add(preference)
        db.flush()
    return preference


def _user_out(db: Session, user: User) -> UserOut:
    output = UserOut.model_validate(user)
    output.preferences = UserPreferenceOut.model_validate(_preference(db, user.id))
    return output


def _auth_response(db: Session, user: User) -> AuthToken:
    return AuthToken(access_token=create_access_token(user.id), user=_user_out(db, user))


@router.post("/register", response_model=AuthToken, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(
        email=body.email,
        name=body.name.strip() if body.name else None,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    seed_first_article(user, db)
    db.commit()
    return _auth_response(db, user)


@router.post("/login", response_model=AuthToken)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _auth_response(db, user)


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _user_out(db, current_user)


@router.get("/me/preferences", response_model=UserPreferenceOut)
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    preference = _preference(db, current_user.id)
    db.commit()
    return preference


@router.patch("/me/preferences", response_model=UserOut)
def update_preferences(body: PreferencesUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    values = body.model_dump(exclude_unset=True)
    preference = _preference(db, current_user.id)
    if "preferred_level" in values:
        current_user.preferred_level = values.pop("preferred_level")
    completed = values.pop("onboarding_completed", None)
    if completed is True:
        preference.onboarding_completed_at = datetime.now(timezone.utc)
    elif completed is False:
        preference.onboarding_completed_at = None
    if "silent_profile" in values:
        values["silent_profile"] = values["silent_profile"].model_dump()
    for name, value in values.items():
        setattr(preference, name, value)
    db.commit()
    db.refresh(current_user)
    return _user_out(db, current_user)
