const STORAGE_KEY = 'flashie:sound'

let context: AudioContext | null = null

export const isSoundOn = () => localStorage.getItem(STORAGE_KEY) !== 'off'

export const setSoundOn = (value: boolean) => localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')

/**
 * Hai tiếng ngắn báo đúng/sai, tổng hợp bằng WebAudio nên không thêm file
 * media nào vào bundle. Đúng: sine đi lên. Sai: triangle đi xuống.
 */
export function playFeedback(kind: 'correct' | 'wrong') {
  if (!isSoundOn()) return

  try {
    context = context ?? new AudioContext()
    // Trình duyệt treo AudioContext cho tới lần tương tác đầu tiên.
    if (context.state === 'suspended') void context.resume()

    const now = context.currentTime

    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    gain.connect(context.destination)

    const osc = context.createOscillator()
    osc.type = kind === 'correct' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(kind === 'correct' ? 660 : 300, now)
    osc.frequency.linearRampToValueAtTime(kind === 'correct' ? 990 : 200, now + 0.16)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.2)
  } catch {
    // Không có quyền phát âm thanh thì bỏ qua — không được chặn việc học.
  }
}
