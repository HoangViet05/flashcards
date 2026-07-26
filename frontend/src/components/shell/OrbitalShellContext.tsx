import { createContext, useContext } from 'react'

export type OrbitalShellHeader = { eyebrow: string; title: string; streak: number | null }
export const defaultOrbitalHeader: OrbitalShellHeader = { eyebrow: 'LEARNING OS', title: 'Today', streak: null }
export const OrbitalShellContext = createContext<{ header: OrbitalShellHeader; setHeader: (header: OrbitalShellHeader) => void }>({ header: defaultOrbitalHeader, setHeader: () => undefined })
export const useOrbitalShell = () => useContext(OrbitalShellContext)
