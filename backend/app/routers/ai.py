from fastapi import APIRouter, HTTPException
from app.schemas.ai import AIGenerateRequest, AIGenerateResponse, AIBatchGenerateRequest, AIBatchGenerateResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

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