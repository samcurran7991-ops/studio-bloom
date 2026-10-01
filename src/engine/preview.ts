// Personalised previews for sales outreach.
// /s/preview?studio=Glow+Brows&artist=Jess&city=Bakersfield&ig=glowbrows&rating=4.9&reviews=87
// shows the sample studio page with the prospect's own details, clearly marked as a preview.
// Nothing is saved: preview pages behave like the demo studio (no real leads, no tracking).
import type { Studio, StudioConfig } from './types'
import { DEMO_STUDIO } from './demoStudio'

export interface PreviewParams {
  studio?: string
  artist?: string
  city?: string
  ig?: string
  rating?: string
  reviews?: string
}

export const PREVIEW_SLUG = 'preview'
const KEYS: (keyof PreviewParams)[] = ['studio', 'artist', 'city', 'ig', 'rating', 'reviews']

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[<>{}[\]\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Reads the preview details from a query string ("?studio=…") or an object of search params. */
export function readPreviewParams(search: string | URLSearchParams | Record<string, unknown>): PreviewParams {
  const get = (k: string): unknown => {
    if (typeof search === 'string') return new URLSearchParams(search).get(k)
    if (search instanceof URLSearchParams) return search.get(k)
    return search[k]
  }
  const out: PreviewParams = {}
  for (const k of KEYS) {
    const v = clean(get(k), k === 'studio' ? 60 : 40)
    if (v) out[k] = v
  }
  if (out.ig) out.ig = out.ig.replace(/^@/, '').replace(/[^\w.]/g, '')
  if (out.rating && !/^[1-5](\.\d)?$/.test(out.rating)) delete out.rating
  if (out.reviews && !/^\d{1,5}$/.test(out.reviews)) delete out.reviews
  return out
}

export const hasPreviewParams = (p: PreviewParams) => Boolean(p.studio)

export function initialsOf(name: string): string {
  const words = name.replace(/&/g, ' ').split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|and|of|by|studio|studios|pmu|beauty)$/i.test(w))
  const letters = (words.length ? words : [name]).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
  return letters || 'S'
}

/** Removes "[placeholder]" text left in the sample studio, so a preview never shows brackets. */
function stripPlaceholders(text: string): string {
  return text.replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim()
}

export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn)
    return out as T
  }
  return value
}

/** The sample studio, re-dressed with a prospect's own details. */
export function previewStudio(p: PreviewParams, base: Studio = DEMO_STUDIO): Studio {
  const b = base.config
  const name = p.studio || b.name
  // Never fall back to the sample artist's name: a prospect must not see someone else's name.
  const artist = p.artist || 'Your artist'
  // Swap the sample studio's and artist's names everywhere they appear in the copy.
  const swap = (s: string) => s.split(b.name).join(name).split(b.artist.name).join(artist)
  const cfg: StudioConfig = mapStrings(b, swap)
  const team = cfg.team.map((m) => ({ ...m, name: m.id === 'artist' ? artist : stripPlaceholders(m.name) || m.title, phone: '', hours: stripPlaceholders(m.hours) }))
  const config: StudioConfig = {
    ...cfg,
    name,
    initials: initialsOf(name),
    city: p.city || '',
    artist: { ...cfg.artist, name: artist, years: '', bio: `Your story goes here: how you started, what you specialise in, and why clients trust you.` },
    rating: p.rating || '',
    reviewCount: p.rating && p.reviews ? p.reviews : '',
    replyTime: stripPlaceholders(cfg.replyTime) || 'a few hours',
    address: p.city || '',
    hours: stripPlaceholders(cfg.hours),
    phone: '',
    instagram: p.ig ? '@' + p.ig : '',
    bookingUrl: '',
    services: cfg.services.map((s) => ({ ...s, why: stripPlaceholders(s.why) })),
    faqs: cfg.faqs.map((f) => ({ ...f, q: stripPlaceholders(f.q), a: stripPlaceholders(f.a) })),
    team,
  }
  return { ...base, slug: PREVIEW_SLUG, config, texting: true }
}

/** "Glow Brows" + base URL → the prospect's personalised page link. */
export function previewLink(baseUrl: string, p: PreviewParams): string {
  const q = new URLSearchParams()
  for (const k of KEYS) { const v = p[k]; if (v) q.set(k, v) }
  return `${baseUrl.replace(/\/$/, '')}/s/${PREVIEW_SLUG}?${q.toString()}`
}

// ---- Dashboard preview (demo mode only) ----
// /dashboard?studio=Glow+Brows&artist=Jess shows the sample dashboard under the prospect's studio name.
// The details are kept for this browser tab, so they survive clicking around the dashboard.
const DASH_KEY = 'sf-preview'

export function dashboardPreviewParams(search: string): PreviewParams | null {
  const fromUrl = readPreviewParams(search)
  try {
    if (hasPreviewParams(fromUrl)) { sessionStorage.setItem(DASH_KEY, JSON.stringify(fromUrl)); return fromUrl }
    const saved = sessionStorage.getItem(DASH_KEY)
    if (saved) { const p = readPreviewParams(JSON.parse(saved) as Record<string, unknown>); if (hasPreviewParams(p)) return p }
  } catch { /* storage blocked: fall back to the URL only */ }
  return hasPreviewParams(fromUrl) ? fromUrl : null
}

/** The owner's demo studio shown under the prospect's name (keeps its id and slug so demo data still loads). */
export function dashboardPreviewStudio(s: Studio, p: PreviewParams): Studio {
  const dressed = previewStudio(p, s)
  return { ...s, config: dressed.config }
}

/** Link to the matching personalised studio page, or '' when no preview is active. */
export function previewPageHref(src: string): string {
  let p: PreviewParams | null = null
  try { const saved = sessionStorage.getItem(DASH_KEY); if (saved) p = readPreviewParams(JSON.parse(saved) as Record<string, unknown>) } catch { /* ignore */ }
  return p && hasPreviewParams(p) ? previewLink('', p) + '&src=' + encodeURIComponent(src) : ''
}

/** Demo data (texts, notes) mentions the sample studio; while a dashboard preview is active, swap in the prospect's names. */
export function previewSwapper(sample: StudioConfig = DEMO_STUDIO.config): ((s: string) => string) | null {
  let p: PreviewParams | null = null
  try { const saved = sessionStorage.getItem(DASH_KEY); if (saved) p = readPreviewParams(JSON.parse(saved) as Record<string, unknown>) } catch { return null }
  if (!p || !p.studio) return null
  const name = p.studio
  const artist = p.artist || 'your artist'
  const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const compact = slug.replace(/-/g, '')
  const short = sample.name.replace(/\s+(Brow|Beauty|PMU)?\s*Studio$/i, '')
  const artistRe = new RegExp('\\b' + sample.artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
  return (s: string) => {
    let out = s.split(sample.name).join(name).split(short).join(name)
      .replace(/\/s\/arch-and-ink\b/g, '/s/' + slug).replace(/archandink|archink/g, compact)
    out = out.replace(artistRe, artist).replace(new RegExp('\\b' + sample.artist.name.toLowerCase() + '@', 'g'), artist.toLowerCase().replace(/[^a-z0-9]/g, '') + '@')
    return out
  }
}
