import { useEffect, useState } from 'react'

import { ExternalLinkIcon, GlobeIcon } from '../../../components/AppIcons'
import type { LessonResource } from '../api/learningApi'
import { EMBED_TIMEOUT_MS, FALLBACK_MESSAGE, SANDBOX, isWebAddress } from './externalResourceRules'
import { glassPanel, primaryButton } from './ui'

function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** A link to the original page, in a new tab that cannot reach back into MUSTANET. */
function OriginalLink({ url, className }: { url: string; className: string }) {
  if (!isWebAddress(url)) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      Open original resource <ExternalLinkIcon className="h-4 w-4" />
    </a>
  )
}

/** When the page cannot be shown here: say so plainly, and offer it in a new tab. */
export function ExternalResourceFallback({ url }: { url: string }) {
  return (
    <output className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <GlobeIcon className="h-6 w-6" />
      </span>
      <p className="max-w-xl text-sm leading-6 text-slate-700">{FALLBACK_MESSAGE}</p>
      <OriginalLink url={url} className={primaryButton} />
    </output>
  )
}

/**
 * The page itself, in a frame that loads straight from its own site in the
 * learner's browser - MUSTANET never fetches or copies it. A loading state shows
 * until the page arrives; when it does not arrive in time, or the frame fails,
 * the fallback takes its place.
 *
 * A site that forbids framing (X-Frame-Options, CSP frame-ancestors) is not
 * reported to the page by the browser - the frame may simply stay blank - so a
 * way to the original is always offered under the frame as well.
 */
export function EmbeddedResourceViewer({
  resource,
  timeoutMs = EMBED_TIMEOUT_MS,
}: {
  resource: LessonResource
  timeoutMs?: number
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')

  useEffect(() => {
    if (state !== 'loading') return
    const timer = window.setTimeout(() => setState('failed'), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [state, timeoutMs])

  if (!isWebAddress(resource.url) || state === 'failed') {
    return <ExternalResourceFallback url={resource.url} />
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/10">
        {state === 'loading' && (
          <output className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 text-sm text-slate-600">
            <span
              aria-hidden="true"
              className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600"
            />
            Loading the resource…
          </output>
        )}
        <iframe
          src={resource.url}
          title={`${resource.title} (external resource)`}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          loading="lazy"
          allow="fullscreen; clipboard-write"
          allowFullScreen
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className="block h-[70vh] max-h-[56rem] min-h-[26rem] w-full border-0"
        />
      </div>
      <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <span>Page not showing? Some sites do not allow being shown inside MUSTANET.</span>
        <OriginalLink
          url={resource.url}
          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline focus:outline-none focus-visible:underline"
        />
      </p>
    </div>
  )
}

/** One external resource in a lesson: its title, a line about it, and the page. */
export function ExternalResourceCard({ resource }: { resource: LessonResource }) {
  return (
    <section aria-labelledby={`resource-${resource.id}`} className={`${glassPanel} p-5 sm:p-6`}>
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"
        >
          <GlobeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`resource-${resource.id}`}
            className="scroll-mt-[calc(var(--app-chrome-height,0px)+2rem)] font-semibold text-slate-900"
          >
            {resource.title}
          </h2>
          {resource.description && (
            <p className="mt-0.5 text-sm text-slate-600">{resource.description}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">From {siteOf(resource.url)}</p>
        </div>
      </header>
      {resource.kind === 'embed' ? (
        <EmbeddedResourceViewer key={resource.url} resource={resource} />
      ) : (
        <ExternalResourceFallback url={resource.url} />
      )}
    </section>
  )
}
