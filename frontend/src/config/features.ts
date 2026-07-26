const enabled = (value: string | boolean | undefined, productionDefault = false) => {
  if (value === undefined || value === '') return import.meta.env.PROD ? productionDefault : true
  return value === true || value === 'true' || value === '1'
}

export const features = {
  learningOs: enabled(import.meta.env.VITE_FEATURE_LEARNING_OS),
  progression: enabled(import.meta.env.VITE_FEATURE_PROGRESSION),
  boss: enabled(import.meta.env.VITE_FEATURE_BOSS),
  audio: enabled(import.meta.env.VITE_FEATURE_AUDIO),
} as const
