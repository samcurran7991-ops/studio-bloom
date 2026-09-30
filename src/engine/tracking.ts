import type { Source } from './types'


// Works out where a visitor came from, once per browser session.
//  - Our own tracking links use ?src=ig-bio | ig-dm | ig-comment | meta-ad | meta-form | google
//  - Meta ads also add fbclid; Google adds gclid; UTM tags are read as a fallback.
//  - ?campaign= (or utm_campaign) records the ad campaign name.

const KEY = 'sf-visit'
const VALID: Source[] = ['ig-bio', 'ig-dm', 'ig-comment', 'meta-ad', 'meta-form', 'google', 'direct']

export interface Visit {
  sessionId: string
  source: Source
  campaign?: string | undefined
}

function detect(): Omit<Visit, 'sessionId'> {
  const p = new URLSearchParams(window.location.search)
  const src = (p.get('src') || '').toLowerCase() as Source
  const campaign = p.get('campaign') || p.get('utm_campaign') || undefined
  if (VALID.includes(src)) return { source: src, campaign }
  const utm = (p.get('utm_source') || '').toLowerCase()
  const medium = (p.get('utm_medium') || '').toLowerCase()
  if (p.get('fbclid') || /facebook|fb|meta/.test(utm)) return { source: /paid|cpc|ad/.test(medium) || p.get('fbclid') ? 'meta-ad' : 'ig-bio', campaign }
  if (/instagram|ig/.test(utm)) return { source: 'ig-bio', campaign }
  if (p.get('gclid') || /google|gbp/.test(utm)) return { source: 'google', campaign }
  if (/instagram\.com/.test(document.referrer)) return { source: 'ig-bio', campaign }
  if (/google\./.test(document.referrer)) return { source: 'google', campaign }
  return { source: 'direct', campaign }
}

export function getVisit(): Visit {
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* storage blocked */ }
  const v: Visit = { sessionId: Math.random().toString(36).slice(2) + Date.now().toString(36), ...detect() }
  try { sessionStorage.setItem(KEY, JSON.stringify(v)) } catch { /* ignore */ }
  return v
}
