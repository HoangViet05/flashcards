import '@testing-library/jest-dom/vitest'

// jsdom không cài đặt Web Animations API. Shim tối thiểu đủ để kiểm tra rằng
// helper trả về một animation đã hoàn thành khi người dùng tắt hiệu ứng.
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    let resolveFinished: (value: unknown) => void = () => undefined
    const finishedPromise = new Promise(resolve => { resolveFinished = resolve })
    const animation = {
      playState: 'running' as AnimationPlayState,
      finished: finishedPromise,
      cancel() { this.playState = 'idle' },
      finish() { this.playState = 'finished'; resolveFinished(this) },
    }
    return animation as unknown as Animation
  }
}
