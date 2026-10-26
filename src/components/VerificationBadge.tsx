import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react'
import { type VerificationLevel } from '../data/fixtures'
import { useI18n } from '../i18n'

const TONE: Record<VerificationLevel, string> = {
  0: 'bg-paper-2 text-stone border-sand',
  1: 'bg-[#f3e9d2] text-[#7a5a1c] border-[#e4d1a3]',
  2: 'bg-[#f6e3bf] text-[#7a4f0e] border-gold/50',
  3: 'bg-[#f5dccb] text-ochre-dark border-ochre/40',
  4: 'bg-moss-light text-moss border-moss/40',
}

export function levelTone(level: VerificationLevel) {
  return TONE[level]
}

export default function VerificationBadge({
  level,
  size = 'sm',
}: {
  level: VerificationLevel
  size?: 'sm' | 'md'
}) {
  const { fixtures } = useI18n()
  const meta = fixtures.verificationLevels[level]
  const Icon = level === 0 ? ShieldAlert : level >= 3 ? ShieldCheck : Shield
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-[0.08em] ${TONE[level]} ${
        size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
      }`}
      title={`${meta.name}: ${meta.description}`}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.2} className="shrink-0" />
      <span className="truncate">
        L{level} · {meta.short}
      </span>
    </span>
  )
}
