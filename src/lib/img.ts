/** Serve generated imagery from /img (with Netlify Image CDN parameters when deployed on Netlify). */
export function img(name: string, _w?: number, _q = 75) {
  return `/img/${name}.png`
}

export function imgSrcSet(name: string, widths: number[]) {
  return widths.map((w) => `${img(name, w)} ${w}w`).join(', ')
}
