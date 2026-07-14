from fastapi import APIRouter, Depends, HTTPException
from app.schemas.ai import AIGenerateRequest, AIGenerateResponse, AIBatchGenerateRequest, AIBatchGenerateResponse
from app.services.ai_service import ai_service
from fastapi.responses import StreamingResponse
from app.services.security import get_current_user
import json

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
    dependencies=[Depends(get_current_user)],
)

@router.post("/generate", response_model=AIGenerateResponse)
async def generate_vocab(body: AIGenerateRequest):
    result = ai_service.generate_card_content(body.word, body.excluded_words)
    
    if not result:
        raise HTTPException(
            status_code=500, 
            detail="Không thể tạo nội dung từ AI. Hãy kiểm tra Ollama đã chạy chưa."
        )
    
    return result

@router.post("/generate-batch", response_model=AIBatchGenerateResponse)
async def generate_vocab_batch(body: AIBatchGenerateRequest):
    result = ai_service.generate_batch_content(body.topic, body.count, body.excluded_words)
    
    if result is None:
        raise HTTPException(
            status_code=500, 
            detail="Không thể sinh danh sách thẻ từ AI. Hãy thử lại."
        )
    
    # Map kết quả từ list dict sang schema AIBatchGenerateResponse
    # Nếu kết quả ít hơn hoặc nhiều hơn count một chút cũng không sao, trả về những gì LLM sinh ra
    return {"cards": result}

@router.post("/generate-batch-stream")
async def generate_vocab_batch_stream(body: AIBatchGenerateRequest):
    """
    Tạo AI Cards nhưng stream từng thẻ về FE ngay khi hoàn thành theo chuẩn Server-Sent Events (SSE).
    """
    # Ở FastAPI, StreamingResponse mong đợi một "Generator". Hàm lồng bên trong này chính là Generator đó.
    def event_stream():
        # Vòng lặp này sẽ tiêu thụ từng chiếc thẻ trả về từ chữ "yield" bên service kia
        for card in ai_service.generate_batch_stream(body.topic, body.count, body.excluded_words):
            # SSE yêu cầu format chặt chẽ: data phải bắt đầu bằng chữ "data: " 
            # Đóng gói Json bằng json.dumps() và kết thúc luồng với "\n\n" (2 dấu xuống dòng)
            yield f"data: {json.dumps(card, ensure_ascii=False)}\n\n"
        
        # Khi xong hết tất cả vòng lặp, ta gửi một cờ [DONE] để báo Frontend (Client) ngắt kết nối
        yield "data: [DONE]\n\n"
    # Trả về Response chứa Generator và header media_type chuẩn là "text/event-stream"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
