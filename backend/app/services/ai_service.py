import ollama
import json
import re

class AIservice:
    def __init__(self, model_name: str = "Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-v2-Q4_K_M"):
        self.model_name = model_name

    def generate_card_content(self, topic: str):
        # Gửi yêu cầu đến model để tạo từ vựng cho một chủ đề
        prompt = f"""
        Nhiệm vụ: Tạo nội dung học tiếng Anh cho chủ đề: "{topic}".
        Yêu cầu trả về định dạng JSON duy nhất không có thêm bất kì câu dẫn dắt nào chỉ là JSON thôi với các trường sau:
        - front_text: Từ vựng tiếng anh liên quan đến chủ để đã cho(kèm phiên âm nếu có)
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
            # options={'num_predict': 800} giới hạn độ dài phản hồi (thinking và trả lời)
            # Tránh model suy nghĩ quá lâu dẫn đến hallucination

            response = ollama.chat(
                model=self.model_name,
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options = {
                    'num_predict': 1024,
                    'temperature': 0.2,
                }
            )

            # trích xuất nội dung từ response
            content = response['message']['content']
            print(content)

            # Parse chuỗi JSON trả về thành dict
            # Lưu ý: LLM đôi khi trả về text thừa, cần xử lý cẩn thận trong thực tế

            return json.loads(content)
        except Exception as e:
            print(f"Lỗi {e}")
            return None

ai_service = AIservice()

if __name__ == "__main__":
    print(f"Đang test với model {ai_service.model_name}...")
    # Thử truyền vào một chủ đề:
    test_topic = "Information Technology"
    
    result = ai_service.generate_card_content(test_topic)
    
    if result:
        print("\nKết quả trả về thành công:")
        # In ra định dạng đep mắt (đã thụt lề)
        print(json.dumps(result, indent=4, ensure_ascii=False))
    else:
        print("\nTest thất bại, có lỗi xảy ra hoặc Ollama không phản hồi đúng định dạng JSON.")
