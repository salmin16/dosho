import { useEffect, useState } from 'react'

const KEY = 'mc:saved-projects'

/** Saved projects live in localStorage until accounts arrive in a later milestone. */
export function useSavedProjects() {
  const [saved, setSaved] = useState<string[]>([])

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    } catch {
      setSaved([])
    }
  }, [])

  const toggle = (id: string) => {
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return { saved, toggle, isSaved: (id: string) => saved.includes(id) }
}
