/** Serve generated imagery from /img with base URL support for root (Vercel/Netlify) and subpath (GitHub Pages). */
export function img(name: string, _w?: number, _q = 75) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/img/${name}.png`
}

export function imgSrcSet(name: string, widths: number[]) {
  return widths.map((w) => `${img(name, w)} ${w}w`).join(', ')
}
