import { Link } from 'react-router-dom'
import { ArrowRight, Compass } from 'lucide-react'
import Badge from './Badge.jsx'
import Reveal from './Reveal.jsx'

/**
 * Module-neutral "foundation ready" scaffold page.
 * Event and Administration each supply their own copy and feature list;
 * no business logic lives here.
 */
function ModulePlaceholder({ eyebrow, title, lead, status, features = [], sourcePath, handover }) {
  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-edge-subtle pb-6">
        <div className="flex max-w-readable flex-col gap-3">
          {eyebrow && (
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-brand-400">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem]">{title}</h1>
          <p className="text-[1.0625rem] text-muted">{lead}</p>
        </div>
        {status && (
          <Badge variant="success" dot>
            {status}
          </Badge>
        )}
      </header>

      <section className="mt-10">
        <h2 className="mb-2 text-xl">Planned capabilities</h2>
        <p className="mb-6 text-sm text-subtle">
          Visual placeholders only — no functionality is implemented at this stage.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const isClickable = Boolean(feature.to)
            const CardContent = (
              <>
                <span
                  className={`grid size-10 place-items-center rounded-sm text-brand-400 ${
                    isClickable ? 'bg-brand-500/15 text-brand-300' : 'bg-brand-500/10'
                  }`}
                  aria-hidden="true"
                >
                  <feature.icon size={20} strokeWidth={1.6} />
                </span>
                <h3 className="text-[1.0625rem] text-ink font-medium">{feature.name}</h3>
                <p className="text-sm text-subtle">{feature.hint}</p>
                {isClickable ? (
                  <span className="mt-auto flex items-center justify-between border-t border-edge-subtle pt-3 font-mono text-xs uppercase tracking-[0.1em] text-brand-400 transition-colors group-hover:text-brand-300">
                    <span>{feature.status || 'Active module'}</span>
                    <ArrowRight size={14} className="transition-transform duration-fast group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="mt-auto border-t border-edge-subtle pt-3 font-mono text-xs uppercase tracking-[0.1em] text-faint">
                    Not implemented
                  </span>
                )}
              </>
            )

            return (
              <Reveal
                as="li"
                key={feature.name}
                delay={index * 40}
                className={`rounded-md border border-edge-subtle bg-surface-1 transition-all duration-base ease-standard ${
                  isClickable
                    ? 'hover:border-brand-500/40 hover:bg-surface-2 group'
                    : 'hover:border-edge hover:bg-surface-2'
                }`}
              >
                {isClickable ? (
                  <Link
                    to={feature.to}
                    className="flex h-full flex-col gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 rounded-md"
                  >
                    {CardContent}
                  </Link>
                ) : (
                  <div className="flex h-full flex-col gap-3 p-5">
                    {CardContent}
                  </div>
                )}
              </Reveal>
            )
          })}
        </ul>
      </section>

      <Reveal className="mt-10 flex flex-col gap-4 rounded-md border border-edge bg-surface-1 bg-linear-140 from-brand-700/15 to-70% to-transparent p-6 sm:flex-row">
        <Compass size={24} strokeWidth={1.6} className="shrink-0 text-brand-400" aria-hidden="true" />
        <div>
          <h2 className="mb-2 text-[1.0625rem]">Development starts here</h2>
          <p className="max-w-readable text-sm text-muted">{handover}</p>
          {sourcePath && (
            <code className="mt-3 inline-block rounded-sm border border-edge-subtle bg-surface-3 px-3 py-1 font-mono text-xs text-brand-300">
              {sourcePath}
            </code>
          )}
        </div>
      </Reveal>
    </div>
  )
}

export default ModulePlaceholder
