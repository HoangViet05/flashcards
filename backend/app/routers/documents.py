import os
import uuid
import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db, SessionLocal
from app.models.document import Document
from app.schemas.document import DocumentResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Ensure upload directory exists
UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_pdf_task(doc_id: str):
    """
    Background task to process PDF: count pages and update status.
    This is where RAG logic (extraction/embedding) will be triggered.
    """
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        # Open and count pages using PyMuPDF
        with fitz.open(doc.file_path) as pdf:
            doc.page_count = len(pdf)
            
        # Update status to ready
        doc.status = "ready"
        db.commit()
    except Exception as e:
        print(f"Error processing PDF {doc_id}: {e}")
        if doc:
            doc.status = "error"
            db.commit()
    finally:
        db.close()

@router.get("", response_model=List[DocumentResponse])
async def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents."""
    return db.query(Document).order_by(Document.created_at.desc()).all()

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Get detail of a specific document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.post("/upload", response_model=DocumentResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a PDF and trigger background processing."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Generate unique filename to avoid collisions
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")

    try:
        # Save file to disk
        content = await file.read()
        with open(saved_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Save metadata to DB
    new_doc = Document(
        filename=file.filename,
        file_path=saved_path,
        status="processing"
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Trigger background processing
    background_tasks.add_task(process_pdf_task, new_doc.id)

    return new_doc

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Delete document metadata and local file."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove physical file
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return {"status": "success", "message": "Document deleted"}
