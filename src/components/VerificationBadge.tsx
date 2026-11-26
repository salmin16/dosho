import { CircleSlash, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { type VerificationLevel } from '../data/fixtures'
import { useI18n } from '../i18n'
import {
  getVerificationSpec,
  normalizeVerificationLevel,
  VERIFICATION_LEVELS,
  type VerificationLevelCode,
} from '../lib/verificationLevels'

const TONE: Record<VerificationLevel, string> = {
  0: VERIFICATION_LEVELS.L0.badgeClasses,
  1: VERIFICATION_LEVELS.L1.badgeClasses,
  2: VERIFICATION_LEVELS.L2.badgeClasses,
  3: VERIFICATION_LEVELS.L3.badgeClasses,
  4: VERIFICATION_LEVELS.L4.badgeClasses,
}

export function levelTone(level: VerificationLevel | VerificationLevelCode) {
  const spec = getVerificationSpec(level)
  return TONE[spec.level]
}

export function VerificationLimitsNotice({
  level,
  compact = false,
}: {
  level: VerificationLevel | VerificationLevelCode
  compact?: boolean
}) {
  const { fixtures } = useI18n()
  const spec = getVerificationSpec(level)
  const localized = fixtures.verificationLevels[spec.level]
  const limitText = localized?.notCovered || spec.limitsOfLevel

  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg border border-ink/10 bg-paper-2/75 text-stone ${
        compact ? 'px-2.5 py-1.5 text-[11px] leading-snug' : 'px-3 py-2 text-xs leading-relaxed'
      }`}
    >
      <CircleSlash size={compact ? 12 : 14} className="mt-0.5 shrink-0 text-ochre" />
      <p className="min-w-0">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
          Limits of This Level ({spec.code}):
        </span>{' '}
        {limitText}
      </p>
    </div>
  )
}

export default function VerificationBadge({
  level,
  size = 'sm',
  showQuota = false,
}: {
  level: VerificationLevel | VerificationLevelCode
  size?: 'sm' | 'md'
  showQuota?: boolean
}) {
  const { fixtures } = useI18n()
  const code = normalizeVerificationLevel(level)
  const spec = VERIFICATION_LEVELS[code]
  const meta = fixtures.verificationLevels[spec.level]
  const Icon = spec.level === 0 ? ShieldAlert : spec.level >= 3 ? ShieldCheck : Shield
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono font-medium uppercase tracking-[0.07em] ${TONE[spec.level]} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
      }`}
      title={`${spec.code} · ${meta?.name ?? spec.title}: ${meta?.description ?? spec.description} (Pilot quota: ${spec.pilotListingQuota})`}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">
        {spec.code} · {meta?.short ?? spec.short}
        {showQuota ? ` · ${spec.pilotListingQuota} slot${spec.pilotListingQuota === 1 ? '' : 's'}` : ''}
      </span>
    </span>
  )
}
