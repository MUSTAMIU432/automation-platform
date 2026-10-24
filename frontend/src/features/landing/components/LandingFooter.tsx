import { Link } from 'react-router-dom'

import { Logo } from '../../../components/Logo'
import { SECTIONS, SIGN_IN_PATH, SIGN_UP_PATH } from '../sections'

const linkClasses =
  'rounded text-sm text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-mint'

export function LandingFooter() {
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
            From real problems to real solutions: a clear, shared path from an idea to working
            software.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-sm font-semibold text-white">Explore</p>
          <ul className="mt-4 space-y-2.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={linkClasses}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold text-white">Account</p>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to={SIGN_IN_PATH} className={linkClasses}>
                Sign In
              </Link>
            </li>
            <li>
              <Link to={SIGN_UP_PATH} className={linkClasses}>
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/auth?mode=forgot-password" className={linkClasses}>
                Forgot password
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-white/50 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} MUSTANET
        </p>
      </div>
    </footer>
  )
}
