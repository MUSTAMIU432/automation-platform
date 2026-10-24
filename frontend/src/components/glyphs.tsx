/**
 * Solid glyphs for the website's glass tiles, its stats bar and the auth pages - heavier than the
 * line icons in icons.tsx, so they read as objects behind glass. Decorative.
 */

interface GlyphProps {
  className?: string
}

export function BulbGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.5a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.3 1.2 2.1v.3h6v-.3c0-.8.5-1.6 1.2-2.1A7 7 0 0 0 12 2.5Z" />
      <rect x="9" y="18.5" width="6" height="1.6" rx=".8" />
      <rect x="10" y="20.9" width="4" height="1.6" rx=".8" />
    </svg>
  )
}

export function GearGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.8a6.7 6.7 0 0 1 0 1.9l2 1.8-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6a6.6 6.6 0 0 1-1.7-.9l-2.5.9-1.7-2.9 2-1.8a6.7 6.7 0 0 1 0-1.9l-2-1.8 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9L10.3 2ZM12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z"
        transform="translate(0 1.5)"
      />
    </svg>
  )
}

export function DocumentGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M6.5 2h7.6L19 6.9V20a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm1.8 8.2h7.4v1.6H8.3v-1.6Zm0 3.4h7.4v1.6H8.3v-1.6Zm0 3.4h5v1.6h-5V17Z"
      />
    </svg>
  )
}

export function CheckGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.6 6.4-6 6-2.8-2.7-1.4 1.4 4.2 4.2 7.4-7.4-1.4-1.5Z"
      />
    </svg>
  )
}

export function BuildingGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 21V5.5L12 2l8 3.5V21h-6v-4h-4v4H4Zm4-12h2v2H8V9Zm6 0h2v2h-2V9Zm-6 4h2v2H8v-2Zm6 0h2v2h-2v-2Z"
      />
    </svg>
  )
}

export function LayersGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m4.3 10.8 7.7 3.9 7.7-3.9L22 12l-10 5-10-5 2.3-1.2Z" opacity=".75" />
      <path d="m4.3 15.8 7.7 3.9 7.7-3.9L22 17l-10 5-10-5 2.3-1.2Z" opacity=".5" />
    </svg>
  )
}

export function UsersGlyph({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0v.5H5V20Z" />
      <circle cx="5" cy="9" r="2.4" opacity=".7" />
      <circle cx="19" cy="9" r="2.4" opacity=".7" />
      <path
        d="M.5 18.5A4.6 4.6 0 0 1 5 13.6c.8 0 1.5.2 2.1.5a8.6 8.6 0 0 0-2.6 4.9H.5v-.5Zm23 0a4.6 4.6 0 0 0-4.5-4.9c-.8 0-1.5.2-2.1.5a8.6 8.6 0 0 1 2.6 4.9h4v-.5Z"
        opacity=".7"
      />
    </svg>
  )
}

/** The little rising bar chart beside each figure in the stats bar. */
export function RisingBars({ className }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 44 28" className={className} fill="currentColor">
      {[6, 10, 14, 19, 24].map((height, index) => (
        <rect
          key={height}
          x={index * 9}
          y={28 - height}
          width="5"
          height={height}
          rx="1.2"
          opacity={0.45 + index * 0.13}
        />
      ))}
    </svg>
  )
}
