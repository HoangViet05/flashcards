from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import AuthToken, LoginRequest, RegisterRequest, UserOut
from app.services.security import create_access_token, get_current_user, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(user: User) -> AuthToken:
    return AuthToken(access_token=create_access_token(user.id), user=user)


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
    return _auth_response(user)


@router.post("/login", response_model=AuthToken)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _auth_response(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
