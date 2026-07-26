import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePreferences } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import AiOrb from '../components/orb/AiOrb'
export default function OnboardingPage() { const [step, setStep] = useState(0); const navigate = useNavigate(); const { setUser } = useAuth(); const finish = async () => { const user = await updatePreferences({ onboarding_completed: true }); setUser(user); navigate('/', { replace: true }) }; const prompts = ['What do you want English to help with?', 'How much time feels realistic?', 'Choose a voice on this device.', 'Make the space yours.', 'Set up sound for your day.']; return <div className="onboarding"><AiOrb state="idle" /><p className="eyebrow">Welcome to Flashie</p><h1>{prompts[step]}</h1><p>Step {step + 1} of 5</p><div className="onboarding-actions">{step < 4 ? <button className="button-primary" onClick={() => setStep(step + 1)}>Continue</button> : <button className="button-primary" onClick={() => void finish()}>Start learning</button>}<button className="button-secondary" onClick={() => void finish()}>Skip for now</button></div></div> }
