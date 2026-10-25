import { useCallback, useState } from 'react'

/**
 * The website's two looks: the brand `green`, and `white` - a white page with
 * near-black text, glass and blue accents. Only the public website switches;
 * the app keeps its own colours.
 */
export type LandingTheme = 'green' | 'white'

const STORAGE_KEY = 'mustanet:landing-theme'

/**
 * The visitor's choice, remembered in this browser. Storage can be unavailable
 * (a private window, blocked site data), so every read and write is guarded and
 * the website simply opens green when nothing can be read.
 */
function readStoredTheme(): LandingTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'white' ? 'white' : 'green'
  } catch {
    return 'green'
  }
}

export function useLandingTheme(): [LandingTheme, (theme: LandingTheme) => void] {
  const [theme, setThemeState] = useState<LandingTheme>(readStoredTheme)

  const setTheme = useCallback((next: LandingTheme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered this time; the switch still applies to this visit.
    }
  }, [])

  return [theme, setTheme]
}
