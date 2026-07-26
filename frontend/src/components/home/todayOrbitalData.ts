import type { DailyHome, Mission, SkillProgressOverview } from '../../types'

export type TodayVisualState = 'loaded' | 'slow-cached' | 'empty-new-user' | 'offline-error'
export type OrbitalIcon = 'today' | 'read' | 'sound' | 'check' | 'mic'

export type OrbitalMission = { id: string; icon: OrbitalIcon; title: string; detail: string; progress: string; percent?: string; done?: boolean }
export type OrbitalSkill = { icon: OrbitalIcon; label: string; level: number; percent: number }
export type TodayOrbitalData = {
  date: string; greeting: string; streak: number; energy: number; wordsReady: number; reviewCount: number; newCount: number; focusMinutes: number
  headline: string; summary: string; primaryLabel: string; primaryTo: string; quickTo: string; reward: string; missions: OrbitalMission[]; skills: OrbitalSkill[]
  completedMissions: number; bossAvailable: boolean; mutationsAvailable: boolean
}

const labels: Record<string, string> = { study_answers: 'Warm up your memory', study_session: 'Warm up your memory', reading_minutes: 'Read with focus', read_complete: 'Read with focus', listen_answers: 'Train your ear', shadowing: 'Train your ear' }
const details: Record<string, string> = { study_answers: 'Review due words', study_session: 'Review due words', reading_minutes: 'Read for focused minutes', read_complete: 'Read a focused article', listen_answers: 'Complete listening prompts', shadowing: 'Complete speaking prompts' }
const iconFor = (skill: string): OrbitalIcon => skill === 'reading' ? 'read' : skill === 'listening' || skill === 'speaking' ? 'sound' : 'today'

export const fixtureTodayData: TodayOrbitalData = {
  date: 'SUNDAY · JUL 26', greeting: 'Good evening, Hoang.', streak: 12, energy: 72, wordsReady: 14, reviewCount: 8, newCount: 6, focusMinutes: 18,
  headline: 'Keep your momentum alive.', summary: '8 reviews, 6 new words and one listening sprint are ready.', primaryLabel: 'Start full session · 24 min', primaryTo: '/daily', quickTo: '/daily/quick', reward: 'Complete to earn +80 XP and power today’s node', completedMissions: 2, bossAvailable: false, mutationsAvailable: true,
  missions: [
    { id: 'memory', icon: 'check', title: 'Warm up your memory', detail: 'Review 8 due words', progress: '+20 XP', done: true },
    { id: 'listen', icon: 'sound', title: 'Train your ear', detail: 'Complete 6 listening prompts', progress: '4/6', percent: '66%' },
    { id: 'read', icon: 'read', title: 'Read with focus', detail: 'Read for 10 focused minutes', progress: '4m', percent: '40%' },
  ],
  skills: [
    { icon: 'today', label: 'Vocabulary', level: 8, percent: 78 }, { icon: 'read', label: 'Reading', level: 6, percent: 61 }, { icon: 'sound', label: 'Listening', level: 4, percent: 44 }, { icon: 'mic', label: 'Speaking', level: 3, percent: 35 },
  ],
}

function skillData(skills: SkillProgressOverview[] | undefined): OrbitalSkill[] {
  if (!skills?.length) return fixtureTodayData.skills
  const ordered = ['vocabulary', 'reading', 'listening', 'speaking']
  return ordered.map((name, index) => {
    const skill = skills.find(item => item.skill === name)
    if (!skill) return fixtureTodayData.skills[index]
    return { icon: iconFor(skill.skill), label: skill.skill[0].toUpperCase() + skill.skill.slice(1), level: skill.level, percent: Math.max(0, Math.min(100, skill.mastery ?? skill.xp % 100)) }
  })
}

function missionData(missions: Mission[] | undefined): OrbitalMission[] {
  if (!missions?.length) return fixtureTodayData.missions
  return missions.slice(0, 3).map(mission => {
    const done = Boolean(mission.completed_at); const percent = mission.target ? Math.round(mission.progress * 100 / mission.target) : 0
    return { id: mission.id, icon: done ? 'check' : iconFor(mission.skill), title: labels[mission.mission_key] ?? mission.mission_key, detail: details[mission.mission_key] ?? `${mission.target} ${mission.skill} steps`, progress: done ? '+20 XP' : mission.mission_key === 'reading_minutes' ? `${mission.progress}m` : `${mission.progress}/${mission.target}`, percent: done ? undefined : `${percent}%`, done }
  })
}

export function toTodayOrbitalData(home: DailyHome, online: boolean): TodayOrbitalData {
  const total = home.new_count + home.due_count; const empty = home.total_cards === 0; const progress = home.progression
  return {
    ...fixtureTodayData, streak: progress?.streak ?? home.streak, energy: home.steps_total ? Math.round(home.steps_done * 100 / home.steps_total) : empty ? 0 : fixtureTodayData.energy,
    wordsReady: total, reviewCount: home.due_count, newCount: home.new_count, focusMinutes: progress?.study_minutes_today ?? 0,
    headline: empty ? 'Build your first learning path.' : home.session_status === 'done' ? 'Today’s core is complete.' : 'Keep your momentum alive.',
    summary: empty ? 'Choose a first source and your learning system will build around it.' : online ? `${home.due_count} reviews, ${home.new_count} new words and one listening sprint are ready.` : 'Cached progress is ready while your connection returns.',
    primaryLabel: empty ? 'Choose your first reading' : home.session_status === 'done' ? 'Review today’s progress' : 'Start full session · 24 min', primaryTo: empty ? '/reader' : home.session_status === 'done' ? '/stats' : '/daily',
    reward: empty ? 'Your first completed session will power today’s node' : online ? 'Complete to earn +80 XP and power today’s node' : 'Progress updates will resume when you reconnect',
    missions: missionData(home.missions?.daily), skills: skillData(progress?.skills), completedMissions: home.missions?.daily.filter(mission => mission.completed_at).length ?? 0,
    bossAvailable: Boolean(home.journey?.boss_available), mutationsAvailable: online,
  }
}

export const fixtureForState = (state: TodayVisualState): TodayOrbitalData => state === 'empty-new-user'
  ? { ...fixtureTodayData, energy: 0, wordsReady: 0, reviewCount: 0, newCount: 0, focusMinutes: 0, streak: 0, headline: 'Build your first learning path.', summary: 'Choose a first source and your learning system will build around it.', primaryLabel: 'Choose your first reading', primaryTo: '/reader', reward: 'Your first completed session will power today’s node', completedMissions: 0, missions: fixtureTodayData.missions.map(item => ({ ...item, done: false, progress: item.id === 'memory' ? '0/8' : item.progress, percent: item.id === 'memory' ? '0%' : item.percent })) }
  : state === 'offline-error' ? { ...fixtureTodayData, summary: 'Cached progress is ready while your connection returns.', reward: 'Progress updates will resume when you reconnect', mutationsAvailable: false }
  : fixtureTodayData
