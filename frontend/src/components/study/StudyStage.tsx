import type { ReactNode } from 'react'
import AiOrb, { type OrbState } from '../orb/AiOrb'

type Props = { eyebrow: string; title: string; state: OrbState; children: ReactNode }

/** Shared, deliberately quiet frame for every active learning exercise. */
export default function StudyStage({ eyebrow, title, state, children }: Props) {
  return <section className="study-stage"><div className="study-stage__halo" aria-hidden="true"><AiOrb state={state} compact /></div><header><p>{eyebrow}</p><h3>{title}</h3></header><div className="study-stage__body">{children}</div></section>
}
