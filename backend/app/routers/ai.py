from fastapi import APIRouter, HTTPException
from app.schemas.ai import AIGenerateRequest, AIGenerateResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/generate", response_model=AIGenerateResponse)
async def generate_vocab(body: AIGenerateRequest):
    result = ai_service.generate_card_content(body.word)
    
    if not result:
        raise HTTPException(
            status_code=500, 
            detail="Không thể tạo nội dung từ AI. Hãy kiểm tra Ollama đã chạy chưa."
        )
    
    return result