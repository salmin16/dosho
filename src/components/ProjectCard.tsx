import { Link } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck, MapPin, ArrowUpRight } from 'lucide-react'
import { formatUsd, type Project } from '../data/fixtures'
import { img } from '../lib/img'
import { useI18n } from '../i18n'
import VerificationBadge from './VerificationBadge'

export default function ProjectCard({
  project,
  saved,
  onToggleSave,
  layout = 'grid',
}: {
  project: Project
  saved?: boolean
  onToggleSave?: (id: string) => void
  layout?: 'grid' | 'row'
}) {
  const { t, tv, localizeProject } = useI18n()
  const p = localizeProject(project)
  const SaveIcon = saved ? BookmarkCheck : Bookmark

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-ink/10 bg-white/60 transition duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white hover:shadow-[0_24px_48px_-28px_rgba(21,18,15,0.45)] ${
        layout === 'row' ? 'grid sm:grid-cols-[240px_1fr]' : 'flex flex-col'
      }`}
    >
      <div className={`relative overflow-hidden bg-ink ${layout === 'row' ? 'aspect-[16/10] sm:aspect-auto' : 'aspect-[16/10]'}`}>
        <img
          src={img(p.image, 640)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 right-12 flex flex-wrap gap-1.5">
          {p.minerals.map((m) => (
            <span key={m} className="rounded-full bg-ink/75 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper backdrop-blur">
              {tv(m)}
            </span>
          ))}
          {p.featured && (
            <span className="rounded-full bg-gold px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
              {t('card.featured')}
            </span>
          )}
        </div>
        <span className="absolute bottom-3 left-3 flex items-center gap-1 text-xs font-medium text-paper">
          <MapPin size={13} /> {p.district}, {p.region}
        </span>
        {onToggleSave && (
          <button
            onClick={(e) => {
              e.preventDefault()
              onToggleSave(p.id)
            }}
            className={`absolute right-3 top-3 z-10 rounded-full p-2 backdrop-blur transition ${
              saved ? 'bg-gold text-ink' : 'bg-ink/50 text-paper hover:bg-ink/80'
            }`}
            aria-label={saved ? t('card.removeSaved') : t('card.saveProject')}
            aria-pressed={saved}
          >
            <SaveIcon size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone">{p.id}</span>
          <VerificationBadge level={p.verification.level} />
        </div>
        <h3 className="font-display text-xl font-medium leading-snug">
          <Link to="/opportunities/$projectId" params={{ projectId: p.id }} className="after:absolute after:inset-0">
            {p.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm text-stone">{tv(p.type)}</p>

        <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-ink/10 pt-4 text-sm mt-5">
          <div className="min-w-0">
            <dt className="truncate font-mono text-[10px] uppercase tracking-wider text-stone">{t('card.seeking')}</dt>
            <dd className="mt-0.5 font-semibold">{formatUsd(p.investmentUsd)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate font-mono text-[10px] uppercase tracking-wider text-stone">{t('card.stage')}</dt>
            <dd className="mt-0.5 break-words font-medium leading-tight">{tv(p.stage)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate font-mono text-[10px] uppercase tracking-wider text-stone">{t('card.licence')}</dt>
            <dd className="mt-0.5 break-words font-medium leading-tight">{tv(p.licence.type)}</dd>
          </div>
        </dl>
        <ArrowUpRight
          size={18}
          className="absolute bottom-5 right-5 text-ochre opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      </div>
    </article>
  )
}
