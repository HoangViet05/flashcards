/**
 * iOS Safari không hỗ trợ navigator.vibrate và không có lộ trình hỗ trợ. Trên
 * iPhone sẽ không rung — đó là giới hạn nền tảng đã biết, không phải lỗi.
 * Một số trình duyệt desktop có thuộc tính này nhưng ném lỗi khi gọi.
 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try { return navigator.vibrate(pattern) } catch { return false }
}
