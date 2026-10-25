import { useLandingTheme } from '../hooks/useLandingTheme'
import { About } from './About'
import { ContactSection } from './ContactSection'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { Services } from './Services'

/**
 * The public website at `/`: what MUSTANET is, its services, how an idea
 * moves through it, and the ways in - the account links go to the real auth
 * page at /auth, and the contact form to the backend's `sendContactMessage`.
 *
 * The header's switch picks the website's look; the attribute here is what the
 * Midnight colours in index.css hang off, so only this page changes.
 */
export function LandingPage() {
  const [theme, setTheme] = useLandingTheme()

  return (
    <div
      data-landing-theme={theme}
      className="min-h-screen bg-white font-sans text-ink antialiased"
    >
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-mint px-4 py-2 font-semibold text-forest focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <LandingHeader theme={theme} onThemeChange={setTheme} />
      <main id="main">
        <Hero />
        <Services />
        <About />
        <HowItWorks />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  )
}
