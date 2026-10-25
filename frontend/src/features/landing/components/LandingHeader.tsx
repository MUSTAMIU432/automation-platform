import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '../../../components/Logo'
import { useAuth } from '../../identity/auth/AuthContext'
import { useActiveSection } from '../hooks/useActiveSection'
import { SECTION_IDS, SECTIONS, SIGN_IN_PATH, SIGN_UP_PATH } from '../sections'
import { CloseIcon, MenuIcon } from './icons'

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest'

/**
 * The website's sticky, translucent header. Section links are plain anchors
 * (the page scrolls; nothing navigates), and the account actions are links
 * into the real auth page - or into the app, for someone already signed in.
 */
export function LandingHeader() {
  const { status } = useAuth()
  const active = useActiveSection(SECTION_IDS)
  const [menuOpen, setMenuOpen] = useState(false)
  const signedIn = status === 'authenticated'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape closes the mobile menu, as it would a dialog.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const accountActions = (layout: 'row' | 'stack') => {
    const size = layout === 'row' ? 'h-11 px-6' : 'h-12 w-full'
    if (signedIn) {
      return (
        <Link
          to="/app"
          className={`inline-flex ${size} items-center justify-center rounded-xl bg-mint text-sm font-semibold text-forest hover:bg-white ${focusRing}`}
        >
          Open your workspace
        </Link>
      )
    }
    return (
      <>
        <Link
          to={SIGN_IN_PATH}
          className={`inline-flex ${size} items-center justify-center rounded-xl border border-white/30 bg-white/5 text-sm font-semibold text-white hover:border-white/50 hover:bg-white/10 motion-safe:transition-colors ${focusRing}`}
        >
          Sign In
        </Link>
        <Link
          to={SIGN_UP_PATH}
          className={`inline-flex ${size} items-center justify-center rounded-xl bg-mint text-sm font-semibold text-forest shadow-[0_0_28px_-4px_rgb(var(--lp-mint)/0.8)] hover:bg-white motion-safe:transition-colors ${focusRing}`}
        >
          Sign Up
        </Link>
      </>
    )
  }

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-5 pt-5 motion-safe:animate-[drop-in_600ms_ease-out] sm:px-8 lg:px-10">
      {/*
        At the top of the page the bar is part of the hero's glass frame; once the page
        scrolls it becomes a floating glass bar, dark enough to read over every section.
      */}
      <div
        className={`pointer-events-auto mx-auto max-w-7xl rounded-2xl border motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-300 ${
          scrolled || menuOpen
            ? 'border-white/10 bg-forest/80 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-6 px-3 sm:px-4 lg:px-5">
          <a href="#home" aria-label="MUSTANET home" className={`rounded-lg ${focusRing}`}>
            <Logo />
          </a>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {SECTIONS.map((section) => {
                const isActive = section.id === active
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      className={`relative inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium motion-safe:transition-colors ${focusRing} ${
                        isActive ? 'text-white' : 'text-white/75 hover:text-white'
                      }`}
                    >
                      {section.label}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-mint motion-safe:transition-transform motion-safe:duration-300 ${
                          isActive ? 'scale-x-100' : 'scale-x-0'
                        }`}
                      />
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 lg:flex">{accountActions('row')}</div>

            <button
              type="button"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white lg:hidden ${focusRing}`}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-white/10 px-4 pb-5 pt-2 motion-safe:animate-[fade-in_150ms_ease-out] lg:hidden"
          >
            <nav aria-label="Mobile">
              <ul className="divide-y divide-white/10">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={section.id === active ? 'location' : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={`flex h-12 items-center text-base font-medium ${focusRing} ${
                        section.id === active ? 'text-mint' : 'text-white/85'
                      }`}
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-4 grid gap-3">{accountActions('stack')}</div>
          </div>
        )}
      </div>
    </header>
  )
}
