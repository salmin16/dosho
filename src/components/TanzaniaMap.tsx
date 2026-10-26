import type { Project } from '../data/fixtures'
import { useI18n } from '../i18n'

/**
 * Stylised Tanzania map drawn from a simplified border outline (illustrative,
 * not survey-grade). A later milestone replaces this with a GIS map layer.
 */
const W = 690
const H = 660
const project = (lng: number, lat: number) => [(lng - 29.2) * 60, (-0.9 - lat) * 60] as const

const BORDER: [number, number][] = [
  [30.48, -1.06], [30.75, -1.0], [33.9, -1.0], [34.07, -1.0], [35.6, -1.9], [36.9, -2.6], [37.7, -3.0],
  [37.75, -3.6], [38.6, -4.1], [39.2, -4.67], [39.1, -5.1], [38.85, -5.9], [38.9, -6.5], [39.3, -6.85],
  [39.45, -7.2], [39.3, -7.8], [39.4, -8.5], [39.55, -9.0], [39.75, -9.6], [39.9, -10.1], [40.45, -10.45],
  [39.8, -10.9], [39.2, -11.15], [38.5, -11.35], [37.8, -11.6], [37.2, -11.7], [36.5, -11.7], [35.8, -11.45],
  [34.95, -11.55], [34.7, -11.0], [34.6, -10.0], [34.35, -9.6], [33.95, -9.45], [33.4, -9.5], [32.95, -9.4],
  [32.2, -8.95], [31.5, -8.65], [30.8, -8.25], [30.55, -7.6], [30.43, -6.82], [30.1, -6.3], [29.8, -6.1],
  [29.9, -5.6], [29.63, -4.88], [29.6, -4.45], [30.05, -4.25], [30.45, -3.6], [30.85, -3.2], [30.65, -2.6],
  [30.55, -2.4], [30.85, -1.65],
]

const LAKE_VICTORIA: [number, number][] = [
  [31.6, -1.0], [33.9, -1.0], [33.95, -1.6], [33.4, -2.1], [32.9, -2.5], [32.2, -2.6], [31.8, -2.0], [31.7, -1.4],
]

const CITIES = [
  { name: 'Dar es Salaam', lng: 39.28, lat: -6.8 },
  { name: 'Dodoma', lng: 35.74, lat: -6.17 },
  { name: 'Mwanza', lng: 32.9, lat: -2.52 },
  { name: 'Arusha', lng: 36.68, lat: -3.37 },
  { name: 'Mbeya', lng: 33.46, lat: -8.9 },
]

const LEVEL_COLOR = ['#9a8f82', '#c9a35c', '#d6a443', '#c0612b', '#3e5c49']

const toPath = (pts: [number, number][]) =>
  pts.map(([lng, lat], i) => `${i ? 'L' : 'M'}${project(lng, lat).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + 'Z'

export default function TanzaniaMap({
  projects,
  selectedId,
  onSelect,
  variant = 'light',
  className = '',
}: {
  projects: Project[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  variant?: 'light' | 'dark'
  className?: string
}) {
  const { t, localizeProject } = useI18n()
  const dark = variant === 'dark'
  const [zx, zy] = project(39.3, -6.15)
  const [px, py] = project(39.75, -5.2)

  return (
    <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className={className} role="img" aria-label={t('map.ariaLabel')}>
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={dark ? '#d6a443' : '#c0612b'} strokeOpacity="0.12" strokeWidth="1.5" />
        </pattern>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#15120f" floodOpacity={dark ? 0.5 : 0.18} />
        </filter>
      </defs>

      {/* graticule */}
      <g stroke={dark ? '#f6f1e7' : '#15120f'} strokeOpacity="0.06" strokeDasharray="2 6">
        {[30, 32, 34, 36, 38, 40].map((lng) => {
          const [x] = project(lng, 0)
          return <line key={lng} x1={x} x2={x} y1={-20} y2={H + 20} />
        })}
        {[-2, -4, -6, -8, -10].map((lat) => {
          const [, y] = project(0, lat)
          return <line key={lat} x1={-20} x2={W + 20} y1={y} y2={y} />
        })}
      </g>

      <path d={toPath(BORDER)} fill={dark ? '#231e1a' : '#ede5d6'} stroke={dark ? '#d6a443' : '#3a322b'} strokeOpacity={dark ? 0.55 : 0.5} strokeWidth="1.4" filter="url(#soft)" />
      <path d={toPath(BORDER)} fill="url(#hatch)" />
      <path d={toPath(LAKE_VICTORIA)} fill={dark ? '#15120f' : '#f6f1e7'} stroke={dark ? '#d6a443' : '#3a322b'} strokeOpacity="0.25" />
      <ellipse cx={zx} cy={zy} rx="9" ry="18" fill={dark ? '#231e1a' : '#ede5d6'} stroke={dark ? '#d6a443' : '#3a322b'} strokeOpacity="0.4" />
      <ellipse cx={px} cy={py} rx="5" ry="12" fill={dark ? '#231e1a' : '#ede5d6'} stroke={dark ? '#d6a443' : '#3a322b'} strokeOpacity="0.4" />

      <text x={project(32.6, -1.75)[0]} y={project(32.6, -1.75)[1]} className="font-mono" fontSize="11" letterSpacing="2" fill={dark ? '#f6f1e7' : '#15120f'} fillOpacity="0.3" textAnchor="middle">
        {t('map.lakeVictoria')}
      </text>
      <text x={project(40.2, -7.6)[0]} y={project(40.2, -7.6)[1]} className="font-mono" fontSize="11" letterSpacing="2" fill={dark ? '#f6f1e7' : '#15120f'} fillOpacity="0.25" transform={`rotate(70 ${project(40.2, -7.6).join(' ')})`}>
        {t('map.indianOcean')}
      </text>

      {CITIES.map((c) => {
        const [x, y] = project(c.lng, c.lat)
        return (
          <g key={c.name}>
            <rect x={x - 2.5} y={y - 2.5} width="5" height="5" fill={dark ? '#f6f1e7' : '#15120f'} fillOpacity="0.5" />
            <text x={x + 8} y={y + 4} fontSize="12" fill={dark ? '#f6f1e7' : '#15120f'} fillOpacity="0.55" className="font-sans">
              {c.name}
            </text>
          </g>
        )
      })}

      {projects.map((raw) => {
        const p = localizeProject(raw)
        const [x, y] = project(p.lng, p.lat)
        const selected = p.id === selectedId
        const color = LEVEL_COLOR[p.verification.level]
        return (
          <g
            key={p.id}
            transform={`translate(${x} ${y})`}
            className={onSelect ? 'cursor-pointer' : ''}
            onClick={() => onSelect?.(p.id)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `${p.title}, ${p.region}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect?.(p.id)
            }}
          >
            {(p.featured || selected) && <circle r="9" fill={color} className="marker-ping" />}
            <circle r={selected ? 12 : 8} fill={color} stroke={dark ? '#15120f' : '#f6f1e7'} strokeWidth="2.5" style={{ transition: 'r 0.2s' }} />
            {selected && <circle r="3.5" fill={dark ? '#15120f' : '#f6f1e7'} />}
          </g>
        )
      })}
    </svg>
  )
}

export function MapLegend({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n()
  const labels = [
    t('map.legend.l0'),
    t('map.legend.l1'),
    t('map.legend.l2'),
    t('map.legend.l3'),
    t('map.legend.l4'),
  ]
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-wider ${dark ? 'text-paper/60' : 'text-stone'}`}>
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[i] }} />
          {l}
        </li>
      ))}
    </ul>
  )
}
