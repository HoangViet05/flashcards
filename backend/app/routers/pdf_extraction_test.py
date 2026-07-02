import os
import json
from docling.document_converter import DocumentConverter
from docling.chunking import HierarchicalChunker

def process_pdf_for_rag(pdf_path, output_dir="output"):
    # Tạo thư mục lưu kết quả nếu chưa có
    os.makedirs(output_dir, exist_ok=True)

    # 1. Khởi tạo Document Converter
    # Quá trình này sẽ tự động tải các mô hình AI (OCR, Layout Analysis) vào bộ nhớ.
    print(f"Đang khởi tạo mô hình và xử lý tài liệu: {pdf_path}...")
    converter = DocumentConverter()
    
    # Thực hiện trích xuất
    result = converter.convert(pdf_path)
    doc = result.document

    # 2. Xuất toàn bộ nội dung ra Markdown
    # Markdown là định dạng tốt nhất để LLM đọc hiểu cấu trúc bảng biểu
    md_content = doc.export_to_markdown()
    md_path = os.path.join(output_dir, "full_document.md")
    
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"[-] Đã xuất bản raw Markdown tại: {md_path}")

    # 3. Tiến hành phân mảnh dữ liệu (Chunking) chuyên dụng cho RAG
    print("Đang tiến hành cắt mảnh (Hierarchical Chunking)...")
    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(doc))

    # 4. Định dạng lại chunks và lưu trữ
    chunk_data = []
    for i, chunk in enumerate(chunks):
        # Trích xuất các metadata hữu ích để nhúng vào Vector DB
        headings = chunk.meta.headings if hasattr(chunk.meta, 'headings') else []
        
        chunk_data.append({
            "chunk_id": i,
            "text": chunk.text,
            "metadata": {
                "headings": headings,
                # Nếu chunk này là một bảng, nó sẽ được bảo toàn cấu trúc
                "is_table": "table" in chunk.text.lower()[:20] 
            }
        })

    json_path = os.path.join(output_dir, "rag_chunks.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(chunk_data, f, ensure_ascii=False, indent=2)
        
    print(f"[-] Hoàn tất! Đã tạo {len(chunks)} chunks, sẵn sàng nạp vào Vector Database.")
    print(f"[-] File chunks được lưu tại: {json_path}")

if __name__ == "__main__":
    # Thay 'sample.pdf' bằng đường dẫn tới tài liệu PDF của bạn
    sample_pdf = r"106231-Article-Text-216836-1-10-20241225.pdf" 
    
    if os.path.exists(sample_pdf):
        process_pdf_for_rag(sample_pdf)
    else:
        print(f"Lỗi: Không tìm thấy file '{sample_pdf}'. Vui lòng đặt file PDF vào cùng thư mục với script này.")