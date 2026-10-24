import { createContext, useContext } from 'react'

/**
 * How the identity form controls draw themselves. `soft` is the auth card's
 * look (rounded, white, gently raised) and is switched on by `AuthShell` for
 * everything inside it; the same controls elsewhere - account settings, the
 * website's contact form - keep the app's ordinary `default` look.
 */
export type FieldAppearance = 'default' | 'soft'

export const FieldAppearanceContext = createContext<FieldAppearance>('default')

export function useFieldAppearance(): FieldAppearance {
  return useContext(FieldAppearanceContext)
}
