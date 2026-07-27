import type { ReactNode, SVGProps } from 'react'

export type IconName = 'today' | 'read' | 'speak' | 'progress' | 'more' | 'settings' | 'account' | 'library' | 'weak' | 'sound' | 'silent' | 'sun' | 'moon' | 'play' | 'bolt' | 'flame' | 'check' | 'mic'

const paths: Record<IconName, ReactNode> = {
  today: <><circle cx="12" cy="12" r="8.5" /><path d="m12 6 1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5L12 6Z" /></>,
  read: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" /><path d="M7 7h2.5M14.5 7H17" /></>,
  speak: <><rect x="8.3" y="2.5" width="7.4" height="11.5" rx="3.7" /><path d="M5.25 10.5a6.75 6.75 0 0 0 13.5 0M12 17.25V21M8.5 21h7" /></>,
  progress: <><path d="M4 19.5V5.5M4 19.5h16" /><path d="m7 15 3.2-3.4 2.8 1.8L18 7" /><circle cx="18" cy="7" r="1.2" fill="currentColor" stroke="none" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.06 2.06-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.05 1.56V20h-2.9v-.1a1.7 1.7 0 0 0-1.05-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.06-2.06.06-.06A1.7 1.7 0 0 0 7.2 14.7a1.7 1.7 0 0 0-1.56-1.05h-.1v-2.9h.1A1.7 1.7 0 0 0 7.2 9.7a1.7 1.7 0 0 0-.34-1.88L6.8 7.76 8.86 5.7l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.05-1.56v-.1h2.9v.1a1.7 1.7 0 0 0 1.05 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.06 2.06-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.05h.1v2.9H21a1.7 1.7 0 0 0-1.6 1.35Z" /></>,
  account: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  library: <><path d="M4 4h12v16H4zM8 4v16M19 5v14" /></>,
  weak: <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /></>,
  sound: <><path d="M4 10h4l5-4v12l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11" /></>,
  silent: <><path d="M4 10h4l5-4v12l-5-4H4zM17 9l4 4M21 9l-4 4" /></>,
  sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.4 15.2A8.6 8.6 0 0 1 8.8 3.6 8.7 8.7 0 1 0 20.4 15.2Z" />,
  play: <path d="m9 5 10 7-10 7V5Z" fill="currentColor" stroke="none" />,
  bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z" />,
  flame: <path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.3-5.4-4.4-7.3.2 2.8-1 4-2.6 4.8.2-3.8-2-6.4-3.7-8.5C7.8 7.9 5 9.7 5 14.4 5 18.5 8 22 12 22Z" />,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  mic: <><rect x="8.3" y="2" width="7.4" height="12" rx="3.7" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></>,
}

export default function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
