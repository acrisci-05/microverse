import { useState } from 'react'
import type { Quality } from '../types/world'

interface Preferences {
  quality: Quality
  reducedMotion: boolean
}
const defaults: Preferences = { quality: 'auto', reducedMotion: false }
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const data = JSON.parse(localStorage.getItem('microverse:preferences') ?? '{}')
      return {
        quality: ['auto', 'low', 'high'].includes(data.quality) ? data.quality : 'auto',
        reducedMotion: data.reducedMotion === true,
      }
    } catch {
      return defaults
    }
  })
  const updatePreferences = (next: Partial<Preferences>) => {
    setPreferences((current) => {
      const updated = { ...current, ...next }
      try {
        localStorage.setItem('microverse:preferences', JSON.stringify(updated))
      } catch {
        /* Preference storage is optional. */
      }
      return updated
    })
  }
  return { preferences, updatePreferences }
}
