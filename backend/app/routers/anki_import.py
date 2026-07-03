import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.anki_import import AnkiImportOut
from app.services import anki_importer
from app.services.anki_importer import ApkgFormatError, import_apkg

router = APIRouter(prefix="/api/anki", tags=["anki"])


@router.post("/import", response_model=AnkiImportOut)
def import_anki_package(file: UploadFile = File(...), db: Session = Depends(get_db)):
    name = (file.filename or "").lower()
    if not name.endswith((".apkg", ".zip")):
        raise HTTPException(status_code=400, detail="Vui lòng chọn file .apkg xuất từ Anki.")

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)
    try:
        summary = import_apkg(tmp_path, db, media_dest=anki_importer.DEFAULT_MEDIA_DEST)
    except ApkgFormatError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return AnkiImportOut(
        decks_created=summary.decks_created,
        cards_created=summary.cards_created,
        decks_skipped=summary.decks_skipped,
        cards_skipped=summary.cards_skipped,
        warnings=summary.warnings,
    )
