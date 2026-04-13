import ollama
import json
import re
import logging

# Cấu hình logging cơ bản
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class AIservice:
    def __init__(self, model_name: str = "Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-v2-Q4_K_M"):
        self.model_name = model_name

    def _extract_clean_word(self, text: str) -> str:
        """Helper để làm sạch chuỗi, loại bỏ phiên âm, chỉ lấy chữ tiếng Anh gốc để check trùng lặp."""
        if not text:
            return ""
        word_match = re.match(r"^[a-zA-Z\s-]+", text)
        return word_match.group(0).strip().lower() if word_match else text.lower().strip()

    def generate_card_content(self, topic: str, excluded_words: list[str] = None):
        # Thiết lập nhắc nhở để tránh trùng lặp
        exclusion_prompt = ""
        if excluded_words and len(excluded_words) > 0:
            # Làm sạch mảng excluded_words trước khi đưa cho LLM để đảm bảo không bị dính ký tự rác/phiên âm
            cleaned_exclusions = [self._extract_clean_word(w) for w in excluded_words]
            exclusion_prompt = f"\nYÊU CẦU ĐẶC BIỆT: Bạn BẮT BUỘC KHÔNG ĐƯỢC tạo ra các từ vựng đã có trong danh sách này: {', '.join(cleaned_exclusions)}. Hãy nghĩ ra một từ vựng tiếng Anh MỚI hoàn toàn so với các từ trên nhưng vẫn nằm trong chủ đề {topic}."

        # Gửi yêu cầu đến model để tạo từ vựng cho một chủ đề
        prompt = f"""
        Nhiệm vụ: Tạo nội dung học tiếng Anh cho chủ đề: "{topic}". {exclusion_prompt}
        Yêu cầu trả về định dạng JSON duy nhất không có thêm bất kì câu dẫn dắt nào chỉ là JSON thôi với các trường sau:
        - front_text: Từ vựng tiếng anh liên quan đến chủ để đã cho (kèm phiên âm nếu có)
        - back_text: Nghĩa tiếng Việt ngắn gọn, chính xác
        - example_sentence: Một câu ví dụ tiếng Anh có sử dụng từ đó (kèm dịch nghĩa)
        Ví dụ:
        {{
            "front_text": "Ambitious /æmˈbɪʃ.əs/",
            "back_text": "Có nhiều tham vọng",
            "example_sentence": "She is an ambitious lawyer. (Cô ấy là một luật sư đầy tham vọng.)"
        }}
        Lưu ý quan trọng: 
        1. Ngắn gọn quá trình suy nghĩ, đi thẳng vào vấn đề.
        2. Cuối cùng, chỉ trả về 1 chuỗi JSON duy nhất tương ứng là 1 từ mà thôi, không sinh thêm chữ nào bên ngoài JSON.
        """

        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options = {
                    'num_predict': 1024,
                    'temperature': 0.6, # Tăng temperature một chút để từ vựng đa dạng hơn, tránh bị lặp nội dung
                }
            )
            content = response['message']['content']
            logger.debug(f"Raw AI response: {content}")
            return json.loads(content)
        except Exception as e:
            logger.error(f"Lỗi khi gọi LLM cho card content: {e}")
            return None

    def generate_batch_content(self, topic: str, count: int = 5, existing_excluded_words: list[str] = None):
        """
        Thay vì yêu cầu LLM trả về danh sách, chúng ta sẽ gọi generate_card_content nhiều lần.
        Sử dụng vòng lặp while để đảm bảo sinh đủ số thẻ (count) dù có thẻ bị lỗi định dạng.
        Đồng thời, truyền mảng các từ đã sinh ra vào để nhắc nhở LLM không cho trùng lặp.
        """
        logger.info(f"Bắt đầu tạo {count} thẻ cho chủ đề: {topic}")
        cards = []
        
        # CỰC KỲ QUAN TRỌNG: Tiền xử lý chuẩn hoá tập từ vựng từ DB truyền sang.
        # Các thẻ cũ có thể ở định dạng "Word /phiên âm/", ta phải gọi helper lấy đúng "word" thôi.
        excluded_words = [self._extract_clean_word(w) for w in existing_excluded_words] if existing_excluded_words else []
        
        attempts = 0
        max_attempts = count * 3  # Cho phép số lần thử tối đa gấp 3 lần số thẻ (VD 5 thẻ -> được thử 15 lần) tránh vòng lặp lặp vô tận

        while len(cards) < count and attempts < max_attempts:
            attempts += 1
            logger.info(f"Đang sinh thẻ thứ {len(cards)+1}/{count} (Lần thử {attempts}/{max_attempts})...")
            
            card = self.generate_card_content(topic, excluded_words)
            
            if card and "front_text" in card:
                front_text = card.get("front_text", "")
                
                # Làm sạch từ AI trả về để check trùng. Ví dụ "AI /eɪ aɪ/" -> "ai"
                clean_word = self._extract_clean_word(front_text)

                # So sánh trực tiếp vì mảng excluded_words đã được làm sạch đồng bộ từ trước
                if clean_word and clean_word not in excluded_words:
                    cards.append(card)
                    excluded_words.append(clean_word)
                    logger.info(f"Tạo thành công từ mới: {clean_word}")
                else:
                    logger.warning(f"Từ bị trùng lặp '{clean_word}', sẽ tiến hành bỏ qua và sinh tự động lại...")
            else:
                logger.warning("Không parse được thẻ từ LLM, định dạng rỗng hoặc lỗi JSON. Đang thử lại...")

        if len(cards) < count:
            logger.error(f"Cảnh báo: Chỉ tạo được {len(cards)}/{count} thẻ sau {max_attempts} lần thử.")
        else:
            logger.info(f"Tuyệt vời! Đã tạo thành công đủ {count} thẻ không trùng lặp.")

        return cards

    def generate_batch_stream(self, topic: str, count: int = 5, existing_excluded_words: list[str] = None):
        """
        [Generator] Trả về từng thẻ qua luồng SSE (Server-Sent Events) ngay khi thẻ được tạo ra,
        giúp luồng dữ liệu stream liên tục về phía user thay vì bắt user chờ sinh xong toàn bộ mảng (batch).
        """
        logger.info(f"Bắt đầu stream tạo {count} thẻ cho chủ đề: {topic}")
        
        excluded_words = [self._extract_clean_word(w) for w in existing_excluded_words] if existing_excluded_words else []
        attempts = 0
        max_attempts = count * 3  
        success_count = 0

        while success_count < count and attempts < max_attempts:
            attempts += 1
            logger.info(f"Đang sinh thẻ thứ {success_count+1}/{count} (Lần thử {attempts}/{max_attempts})...")
            
            # Khác với Streaming token, ở đây ta gọi generate_card_content như bình thường 
            # để lấy được JSON của 1 thẻ (card) đã hoàn chỉnh.
            card = self.generate_card_content(topic, excluded_words)
            
            if card and "front_text" in card:
                front_text = card.get("front_text", "")
                clean_word = self._extract_clean_word(front_text)

                if clean_word and clean_word not in excluded_words:
                    excluded_words.append(clean_word)
                    success_count += 1
                    logger.info(f"Tạo thành công từ mới: {clean_word}")
                    
                    # 🚀 ĐÂY LÀ ĐIỂM CỐT LÕI CỦA TINH CHẤT STREAMING (GENERATOR):
                    # Thay vì cards.append(card) vào list rồi return, ta sẽ dùng lệnh "yield"
                    # "yield" sẽ ném thẳng card này về Router để trả ngay lập tức cho Frontend,
                    # Hàm sẽ tạm dừng tại đây. Quá trình router gửi mạng kết thúc sẽ quay lại vòng lặp while này chạy thẻ kế tiếp.
                    yield card
                else:
                    logger.warning(f"Từ bị trùng lặp '{clean_word}', bỏ qua...")
                    # Ném thẻ bị trùng về cho Frontend để FE có thông tin phát hiệu ứng "Từ chối" (rejected)
                    yield card
            else:
                logger.warning("Lỗi thẻ từ LLM, thử lại...")

        if success_count < count:
            logger.error(f"Chỉ tạo được {success_count}/{count} thẻ sau {max_attempts} lần thử.")


ai_service = AIservice()

if __name__ == "__main__":
    logger.info(f"Đang test BATCH GENERATION với model {ai_service.model_name}...")
    test_topic = "Trí Tuệ Nhân Tạo"
    logger.info(f"Chủ đề test: {test_topic}")
    
    result = ai_service.generate_batch_content(test_topic, 3)
    
    if result:
        logger.info(f"Kết quả trả về thành công ({len(result)} thẻ):\n{json.dumps(result, indent=4, ensure_ascii=False)}")
    else:
        logger.error("Test thất bại, không có thẻ nào được sinh ra.")
