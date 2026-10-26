/** Serve generated imagery through the Netlify Image CDN, never the full-size originals. */
export function img(name: string, w: number, q = 75) {
  return `/.netlify/images?url=/img/${name}.png&w=${w}&fm=webp&q=${q}`
}

export function imgSrcSet(name: string, widths: number[]) {
  return widths.map((w) => `${img(name, w)} ${w}w`).join(', ')
}
