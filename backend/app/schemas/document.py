from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str
    page_count: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
