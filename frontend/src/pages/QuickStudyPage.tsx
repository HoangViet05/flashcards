import { Link } from 'react-router-dom'
import AiOrb from '../components/orb/AiOrb'
export default function QuickStudyPage() { return <div className="quick-study glass-panel"><AiOrb state="idle" /><p className="eyebrow">Five-minute focus</p><h1>Quick Study</h1><p>Review due cards and one listening-ready item. Your streak, XP, and missions still count.</p><Link className="button-primary" to="/daily?mode=quick">Start Quick Study</Link></div> }
