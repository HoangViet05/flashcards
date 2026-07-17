import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.anki_entry import AnkiEntry
from app.schemas.anki_import import AnkiImportOut, AnkiLibraryDeleteOut, AnkiLibraryEntryOut, AnkiLibraryOut, AnkiLibrarySourceOut
from app.services.security import get_current_user
from app.services import anki_importer
from app.services.anki_importer import ApkgFormatError, import_apkg

router = APIRouter(prefix="/api/anki", tags=["anki"])


@router.get("/library", response_model=AnkiLibraryOut)
def get_anki_library(
    search: str = Query(default="", max_length=500),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = db.query(AnkiEntry).filter(AnkiEntry.user_id == user.id)
    query = search.strip()
    if query:
        needle = f"%{query}%"
        base = base.filter(AnkiEntry.front_text.ilike(needle))
    entries = base.order_by(AnkiEntry.imported_at.desc(), AnkiEntry.front_text.asc()).limit(limit).all()
    sources = (
        db.query(AnkiEntry.source_deck, func.count(AnkiEntry.id))
        .filter(AnkiEntry.user_id == user.id)
        .group_by(AnkiEntry.source_deck)
        .order_by(func.count(AnkiEntry.id).desc(), AnkiEntry.source_deck.asc())
        .all()
    )
    return AnkiLibraryOut(
        total=db.query(func.count(AnkiEntry.id)).filter(AnkiEntry.user_id == user.id).scalar() or 0,
        sources=[AnkiLibrarySourceOut(name=name or "Không rõ nguồn", entry_count=count) for name, count in sources],
        entries=[AnkiLibraryEntryOut.model_validate(entry) for entry in entries],
    )


@router.post("/import", response_model=AnkiImportOut)
def import_anki_package(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = (file.filename or "").lower()
    if not name.endswith((".apkg", ".zip")):
        raise HTTPException(status_code=400, detail="Vui lòng chọn file .apkg xuất từ Anki.")

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)
    try:
        summary = import_apkg(tmp_path, db, user.id, media_dest=anki_importer.DEFAULT_MEDIA_DEST)
    except ApkgFormatError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return AnkiImportOut(
        entries_imported=summary.entries_imported,
        entries_skipped=summary.entries_skipped,
        warnings=summary.warnings,
    )


@router.delete("/library", response_model=AnkiLibraryDeleteOut)
def delete_anki_library(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entries_deleted = (
        db.query(AnkiEntry)
        .filter(AnkiEntry.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return AnkiLibraryDeleteOut(entries_deleted=entries_deleted)
