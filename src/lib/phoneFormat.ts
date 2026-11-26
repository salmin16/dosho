/**
 * Gentle, non-intrusive Tanzanian phone number formatting & validation.
 * Never traps cursor movement, paste, or backspace while typing — format
 * gracefully on blur and normalize cleanly before submission.
 */

export function formatTanzaniaPhoneDisplay(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^0-9]/g, '')

  // 07XX XXX XXX (10 local digits)
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }

  // 255 7XX XXX XXX or +255 7XX XXX XXX (12 international digits)
  if (digits.length === 12 && digits.startsWith('255')) {
    const prefix = hasPlus ? '+255' : '255'
    return `${prefix} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }

  // 9 digits starting with 6 or 7 -> 07XX XXX XXX
  if (digits.length === 9 && /^[67]/.test(digits)) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }

  // Leave partial/international inputs untouched so we never trap the user
  return trimmed
}

export function validateTanzaniaPhoneOptional(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/[^0-9]/g, '')
  const validLocal = digits.length === 10 && digits.startsWith('0')
  const validIntl = digits.length === 12 && digits.startsWith('255')
  const validShort = digits.length === 9 && /^[67]/.test(digits)
  if (validLocal || validIntl || validShort) return null
  return 'Use a valid Tanzanian mobile format such as 0712 345 678 or 255 712 345 678.'
}
