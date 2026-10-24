/** The homepage's sections, in page order: the header's links and the scroll-spy's targets. */
export const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'contact', label: 'Contact' },
] as const

export const SECTION_IDS = SECTIONS.map((section) => section.id)

/** Where the website's account actions go: the real auth page, opened on the right view. */
export const SIGN_IN_PATH = '/auth'
export const SIGN_UP_PATH = '/auth?mode=sign-up'
