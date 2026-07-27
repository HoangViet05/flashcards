import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAudio } from '../providers/AudioProvider'
import type { SfxKind } from '../providers/AudioProvider'
import { vibrate } from '../lib/haptics'
import { animate, flyUp, pop } from '../lib/motion'

export type Skill = 'vocabulary' | 'reading' | 'listening' | 'speaking'

const STREAK_MILESTONES = [7, 30, 100]
const COMBO_THRESHOLD = 3

/**
 * API duy nhất để phát phản hồi. Nơi gọi phát ra một sự kiện có ý nghĩa; hook tự
 * quyết định tầng chuyển động và tự kích hoạt cả ba kênh. Không màn nào được tự
 * viết animation phản hồi riêng — đó là điều kiện để tính nhất quán tồn tại về
 * mặt cấu trúc chứ không chỉ về mặt token.
 */
export function useFeedback() {
  const { user } = useAuth()
  const { sfx } = useAudio()
  const enabled = user?.preferences?.feedback_enabled !== false && user?.preferences?.silent_mode !== true
  const hapticOn = enabled && user?.preferences?.haptic_enabled !== false

  const fire = useCallback((sound: SfxKind | null, buzz: number | number[] | null, el: Element | null | undefined, tier: 'tool' | 'reward') => {
    if (!enabled) return
    if (sound) sfx(sound)
    if (buzz && hapticOn) vibrate(buzz)
    if (!el) return
    if (tier === 'reward') { pop(el); return }
    animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], 'snap', 'out')
  }, [enabled, hapticOn, sfx])

  return useMemo(() => ({
    correct: (el?: Element | null) => fire('correct', 10, el, 'tool'),
    // Chuỗi trả lời đúng liên tiếp là khoảnh khắc thưởng có thật trong buổi học,
    // tách khỏi streakKept (đó là chuỗi ngày, không phải chuỗi câu).
    combo: (count: number, el?: Element | null) =>
      count >= COMBO_THRESHOLD ? fire('combo', [12, 24, 12], el, 'reward') : fire('correct', 10, el, 'tool'),
    wrong: (el?: Element | null) => fire('wrong', [15, 40, 15], el, 'tool'),
    saved: (el?: Element | null) => fire('ui', null, el, 'tool'),
    streakKept: (days: number, el?: Element | null) =>
      STREAK_MILESTONES.includes(days)
        ? fire('checkpoint', [20, 30, 20], el, 'reward')
        : fire(null, null, el, 'tool'),
    // XP giữa buổi không phát tiếng: đã có tiếng cho câu đúng rồi, thêm nữa là chồng tiếng.
    // Phần hình là số bay lên, không phải nhịp scale như các sự kiện khác.
    xpGained: (_amount: number, options?: { final?: boolean; el?: Element | null }) => {
      if (!enabled) return
      if (options?.final) { fire('combo', null, options.el, 'reward'); return }
      if (options?.el) flyUp(options.el)
    },
    levelUp: (_skill: Skill, _level: number, el?: Element | null) => fire('levelup', [20, 30, 20, 30, 40], el, 'reward'),
    sessionComplete: (_xp: number, _accuracy: number, el?: Element | null) => fire('complete', [20, 40, 20], el, 'reward'),
  }), [enabled, fire])
}
