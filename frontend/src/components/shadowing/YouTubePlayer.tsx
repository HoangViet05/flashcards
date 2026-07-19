import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { PlayerHandle } from './SegmentPlayer'

interface YTPlayer { seekTo(seconds: number, allowSeekAhead: boolean): void; playVideo(): void; pauseVideo(): void; setPlaybackRate(rate: number): void; getCurrentTime(): number; destroy(): void }
declare global { interface Window { YT?: { Player: new (element: HTMLElement, options: object) => YTPlayer }; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<void> | null = null
const loadApi = () => { if (window.YT?.Player) return Promise.resolve(); if (!apiPromise) apiPromise = new Promise(resolve => { window.onYouTubeIframeAPIReady = resolve; const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag) }); return apiPromise }
export const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; start: number; end: number; rate: number }>(function YouTubePlayer({ videoId, start, end, rate }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null), playerRef = useRef<YTPlayer | null>(null), pollRef = useRef<number | null>(null), segmentRef = useRef({ start, end, rate }); segmentRef.current = { start, end, rate }
  useEffect(() => { let cancelled = false; void loadApi().then(() => { if (!cancelled && containerRef.current && window.YT) playerRef.current = new window.YT.Player(containerRef.current, { videoId, playerVars: { controls: 1, rel: 0 } }) }); return () => { cancelled = true; if (pollRef.current) window.clearInterval(pollRef.current); playerRef.current?.destroy(); playerRef.current = null } }, [videoId])
  useImperativeHandle(ref, () => ({
    play: () => { const player = playerRef.current; if (!player) return; const segment = segmentRef.current; player.setPlaybackRate(segment.rate); player.seekTo(segment.start, true); player.playVideo(); if (pollRef.current) window.clearInterval(pollRef.current); pollRef.current = window.setInterval(() => { if (player.getCurrentTime() >= segmentRef.current.end) { player.pauseVideo(); if (pollRef.current) window.clearInterval(pollRef.current) } }, 120) },
    stop: () => { if (pollRef.current) window.clearInterval(pollRef.current); playerRef.current?.pauseVideo() },
  }), [])
  return <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black"><div ref={containerRef} className="h-full w-full" /></div>
})
