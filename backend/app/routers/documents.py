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

# Đảm bảo thư mục lưu file tồn tại — tạo ra nếu chưa có
UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_pdf_task(doc_id: str):
    """
    Background Task: Xử lý file PDF sau khi upload xong.
    Hiện tại: đếm số trang và cập nhật trạng thái sang 'ready'.
    Tương lai: đây là nơi ta sẽ tích hợp RAG (trích xuất text → chunking → embedding vào ChromaDB).
    """
    # Mở một session DB mới độc lập — vì đây là background task,
    # không dùng chung session với request gốc (đã đóng rồi)
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        # Mở file PDF bằng PyMuPDF và đếm số trang
        with fitz.open(doc.file_path) as pdf:
            doc.page_count = len(pdf)

        # Cập nhật trạng thái sang 'ready' — file đã xử lý xong
        doc.status = "ready"
        db.commit()
    except Exception as e:
        print(f"Lỗi khi xử lý PDF {doc_id}: {e}")
        if doc:
            # Nếu có lỗi, đánh dấu trạng thái 'error' để FE hiển thị cảnh báo
            doc.status = "error"
            db.commit()
    finally:
        # Luôn đóng session sau khi dùng xong để tránh rò rỉ kết nối
        db.close()

@router.get("", response_model=List[DocumentResponse])
async def list_documents(db: Session = Depends(get_db)):
    """Lấy danh sách tất cả tài liệu đã upload, sắp xếp mới nhất trước."""
    return db.query(Document).order_by(Document.created_at.desc()).all()

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết của một tài liệu theo ID."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return doc

@router.post("/upload", response_model=DocumentResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),  # File(...) nghĩa là tham số này bắt buộc phải có
    db: Session = Depends(get_db)
):
    """
    Upload file PDF lên server.
    Quy trình: Kiểm tra định dạng → Lưu file → Ghi metadata vào DB → Kích hoạt xử lý ngầm.
    """
    # Kiểm tra định dạng file — chỉ chấp nhận PDF
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file PDF")

    # Tạo tên file ngẫu nhiên bằng UUID để tránh trùng tên trên ổ cứng
    # (VD: hai người upload "report.pdf" sẽ không ghi đè nhau)
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]  # Lấy phần đuôi file, VD: ".pdf"
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")

    try:
        # Đọc toàn bộ nội dung file từ request và ghi xuống ổ cứng
        content = await file.read()
        with open(saved_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể lưu file: {e}")

    # Lưu metadata vào DB với trạng thái ban đầu là 'processing'
    new_doc = Document(
        filename=file.filename,  # Tên gốc từ người dùng — để hiển thị trên UI
        file_path=saved_path,    # Đường dẫn thực tế trên server — để đọc file sau này
        status="processing"
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)  # Refresh để lấy lại ID vừa được DB tạo ra

    # Kích hoạt background task — chạy ngầm sau khi response đã trả về FE
    # Nhờ vậy API phản hồi ngay lập tức, không bị block bởi việc xử lý PDF
    background_tasks.add_task(process_pdf_task, new_doc.id)

    return new_doc

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Xóa tài liệu: xóa file trên ổ cứng và xóa bản ghi trong DB."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    # Xóa file vật lý trước — nếu không xóa, file sẽ trở thành "rác" trên ổ cứng
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass  # Bỏ qua nếu file đã bị xóa thủ công từ trước

    # Xóa bản ghi metadata trong DB
    db.delete(doc)
    db.commit()
    return {"status": "success", "message": "Đã xóa tài liệu thành công"}
