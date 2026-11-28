/**
 * Shallow-compares two plain objects/records by enumerable keys so unchanged rows
 * retain their exact object reference across silent background refreshes.
 */
function shallowRecordEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true
  const keysA = Object.keys(a) as Array<keyof T>
  const keysB = Object.keys(b) as Array<keyof T>
  if (keysA.length !== keysB.length) return false
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    const valA = a[key]
    const valB = b[key]
    if (valA === valB) continue
    if (
      valA &&
      valB &&
      typeof valA === 'object' &&
      typeof valB === 'object'
    ) {
      if (JSON.stringify(valA) === JSON.stringify(valB)) continue
    }
    return false
  }
  return true
}

/**
 * Merges incoming records by `id` in place:
 * - Preserves exact item references for unchanged records (zero unnecessary re-renders)
 * - Returns the previous array reference if order and every record are identical
 * - Never wipes unrelated UI selections, open drawers, or draft inputs
 */
export function mergeRecordsById<T extends { id: string }>(
  prev: T[],
  next: T[],
): T[] {
  if (!Array.isArray(next)) return prev
  if (prev.length === 0) return next
  if (next.length === 0) return prev.length === 0 ? prev : []

  const prevMap = new Map<string, T>()
  for (let i = 0; i < prev.length; i++) {
    prevMap.set(prev[i].id, prev[i])
  }

  let anyChanged = prev.length !== next.length
  const merged = new Array<T>(next.length)

  for (let i = 0; i < next.length; i++) {
    const incoming = next[i]
    const existing = prevMap.get(incoming.id)
    if (existing && shallowRecordEqual(existing, incoming)) {
      merged[i] = existing
      if (!anyChanged && prev[i] !== existing) {
        anyChanged = true
      }
    } else {
      merged[i] = incoming
      anyChanged = true
    }
  }

  return anyChanged ? merged : prev
}

/**
 * Merges a single nullable record, keeping the previous object reference
 * when all fields are identical.
 */
export function mergeSingleRecord<T extends object>(
  prev: T | null,
  next: T | null,
): T | null {
  if (prev === next) return prev
  if (!prev || !next) return next
  return shallowRecordEqual(prev, next) ? prev : next
}
