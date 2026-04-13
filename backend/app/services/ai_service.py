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
            response = ollama.chat(
                model=self.model_name,
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options = {
                    'num_predict': 1024,
                    'temperature': 0.2,
                }
            )
            content = response['message']['content']
            print(content)
            return json.loads(content)
        except Exception as e:
            print(f"Lỗi {e}")
            return None

    def generate_batch_content(self, topic: str, count: int = 5):
        """
        - BATCH GENERATION
        Nhiệm vụ: Ép LLM trả về một danh sách (array) các object thay vì 1 object.
        
        Kỹ thuật phân tích:
        1. Format specification: Cần phải giải thích rất RÕ RÀNG cho LLM rằng ta muốn 
           một `Danh sách JSON chứa {count} phần tử`. 
        2. Ví dụ (Few-shot prompting): Đưa ra một ví dụ cấu trúc mảng JSON cụ thể 
           sẽ tăng tỷ lệ thành công lên 90% so với không có ví dụ.
        3. Khống chế đầu ra: Yêu cầu không được sinh thêm văn bản giải thích.
        """

        print(count)
        
        prompt = f"""
        Nhiệm vụ: Bạn là một chuyên gia ngôn ngữ. Hãy tạo ra đúng {count} từ vựng tiếng Anh quan trọng nhất thuộc chủ đề: "{topic}".
        
        YÊU CẦU BẮT BUỘC: 
        Chỉ trả về DUY NHẤT một mảng JSON (JSON array), không có văn bản dẫn dắt, không giải thích.
        
        Cấu trúc JSON mỗi phần tử phải gồm:
        - "front_text": Từ tiếng Anh (kèm phiên âm IP nếu có).
        - "back_text": Nghĩa tiếng Việt ngắn gọn, chuẩn xác.
        - "example_sentence": Câu ví dụ tiếng Anh (kèm dịch nghĩa tiếng Việt).
        
        Ví dụ Định dạng đầu ra mong muốn:
        [
            {{
                "front_text": "Ambitious /æmˈbɪʃ.əs/",
                "back_text": "Có nhiều tham vọng",
                "example_sentence": "She is an ambitious lawyer. (Cô ấy là một luật sư đầy tham vọng.)"
            }},
            {{
                "front_text": "Negotiation /nɪˌɡəʊ.ʃiˈeɪ.ʃən/",
                "back_text": "Sự đàm phán",
                "example_sentence": "The negotiation was successful. (Cuộc đàm phán đã thành công.)"
            }}
        ]
        Lưu ý quan trọng: 
        1. Ngắn gọn quá trình suy nghĩ, đi thẳng vào vấn đề.
        2. Cuối cùng, chỉ trả về chuỗi các JSON tương ứng với {count} từ vựng tiếng Anh trong nhiệm vụ có đề cập, không sinh thêm chữ nào bên ngoài JSON.
        """

        try:
            # Lưu ý số 1: Khi yêu cầu output dài hơn, cần tăng num_predict lên tương ứng
            # Tính nhẩm: 1 thẻ ~100 tokens -> 10 thẻ cần ~1000 tokens output. Tổng cho phép ~1500 để an toàn.
            response = ollama.chat(
                model=self.model_name,
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options = {
                    'num_predict': 4096, # Tăng lên để đủ chữ trả về cho mảng lớn
                    'temperature': 0.5,  # Temperature nhỉnh hơn xíu để từ vựng đa dạng hơn
                }
            )

            # Lấy chuỗi raw từ LLM
            content = response['message']['content']
            
            # LLM có thể đôi khi bọc json trong block markdown (tùy vào model)
            # Dù model Llama thường tuân thủ format='json', ta vẫn nên cẩn thận parse nó an toàn.
            print("Raw AI Batch Output:", content)
            
            parsed_data = json.loads(content)
            
            # Validation kết quả trả về
            # Do output có thể là 1 dictionary có schema {"cards": [...]} hoặc trực tiếp là một list [...]
            if isinstance(parsed_data, dict):
                # Một số LLM thích trả dict thay vì list
                keys = list(parsed_data.keys())
                if keys and isinstance(parsed_data[keys[0]], list):
                    return parsed_data[keys[0]]
            
            if isinstance(parsed_data, list):
                return parsed_data
                
            return []
            
        except json.JSONDecodeError as e:
            print(f"Lỗi parse JSON trong Batch Generation: {e}")
            return None
        except Exception as e:
            print(f"Lỗi khi gọi model Ollama (Batch): {e}")
            return None

ai_service = AIservice()

if __name__ == "__main__":
    print(f"Đang test BATCH GENERATION với model {ai_service.model_name}...")
    test_topic = "Trí Tuệ Nhân Tạo"
    print(f"Chủ đề: {test_topic}")
    
    result = ai_service.generate_batch_content(test_topic, 3)
    
    if result:
        print(f"\nKết quả trả về thành công ({len(result)} thẻ):")
        print(json.dumps(result, indent=4, ensure_ascii=False))
    else:
        print("\nTest thất bại.")
