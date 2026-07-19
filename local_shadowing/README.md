# Shadowing Worker

Worker cục bộ chỉ bind `127.0.0.1:8788`, dùng Whisper để chấm nói và yt-dlp để lấy phụ đề YouTube. Audio ghi âm không được lưu hoặc gửi lên server.

## Cài một lần

1. Chạy `install_shadowing.bat`.
2. Thêm domain Vercel vào `APP_ORIGINS` trong `.env` nếu cần.

## Dùng hằng ngày

Chạy `start_shadowing.bat`. Lần chấm đầu sẽ tải model Whisper; worker tự dùng CPU nếu CUDA không sẵn sàng.
