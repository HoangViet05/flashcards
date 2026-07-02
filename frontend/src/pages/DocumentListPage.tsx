// Trang quản lý tài liệu (PDF -> thẻ AI) tạm hoãn cùng các tính năng AI.
// UI upload/danh sách cũ nằm trong lịch sử git — khôi phục khi phát hành lại.
export default function DocumentListPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center animate-fade-in relative">
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none -z-10">
        <div className="w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]" />
      </div>
      <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-5xl mx-auto mb-8 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-sm">
        📄
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">Sắp ra mắt ✨</span>
      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-200 mt-4 mb-3">Tài liệu & tạo thẻ từ PDF</h2>
      <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
        Tải PDF lên và để AI tạo thẻ từ nội dung tài liệu — tính năng này đang được phát triển.
        Trong lúc chờ, hãy học bộ <span className="text-amber-300 font-semibold">4000 Essential English Words</span> nhé!
      </p>
    </div>
  )
}
