# Local Translator — công tắc dịch bằng RTX 4060

Worker này chỉ tạo kết nối HTTPS đi ra Render; không mở port vào laptop. Khi cửa sổ worker đang chạy, nó lấy từng bài đang chờ, dịch bằng GPU và lưu bản dịch kín vào Supabase. Đóng cửa sổ hoặc nhấn `Ctrl+C` là tắt công tắc ngay.

## Cài một lần

1. Chạy `install_worker.bat`.
2. Vào **Tech Reader** trên website, bấm **Kết nối máy dịch**, rồi copy cấu hình được hiển thị.
3. Copy `.env.example` thành `.env`, dán hai dòng `API_BASE_URL` và `WORKER_TOKEN` vừa copy.
4. Bấm đúp `start_worker.bat`. Dòng `Công tắc dịch đang BẬT` nghĩa là máy đã online.

Lần đầu có bài, model `vinai/vinai-translate-en2vi` sẽ tải về và nạp vào GPU. Worker cố ý từ chối chạy CPU để bạn không vô tình làm chậm máy khi không có CUDA.

## Cách dùng hằng ngày

1. Trên web: bấm **Dịch tất cả bài mới**, hoặc nút **Dịch** trên một bài cụ thể.
2. Khi laptop rảnh: bấm đúp `start_worker.bat`.
3. Để nghỉ GPU: quay lại cửa sổ đó và nhấn `Ctrl+C` hoặc đóng cửa sổ.

Trang Tech Reader đánh dấu `Chờ dịch local`, `Máy đang dịch`, hoặc `Đã có bản dịch`. Mã worker chỉ ghép với tài khoản đã tạo nó; không đưa mã này cho người khác và tạo mã mới nếu nghi ngờ bị lộ.
