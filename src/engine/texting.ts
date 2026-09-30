// Text templates on the app side: settings previews and demo-mode simulation.
// The defaults live in one place, shared with the server functions.
import { DEFAULT_FOLLOWUPS, DEFAULT_IG_KEYWORDS, DEFAULT_IG_KEYWORD_REPLY, DEFAULT_IG_WELCOME, DEFAULT_TEMPLATES, FOLLOWUP_KINDS, fill } from '../../supabase/functions/_shared/templates'
import type { Lead, Messaging, Studio, TemplateKey } from './types'
import { SOURCE_LABELS } from './labels'

export { DEFAULT_FOLLOWUPS, DEFAULT_IG_KEYWORDS, DEFAULT_IG_KEYWORD_REPLY, DEFAULT_IG_WELCOME, DEFAULT_TEMPLATES, FOLLOWUP_KINDS, fill }


export const TEMPLATE_INFO: { key: TemplateKey; label: string; when: string }[] = [
  { key: 'booking', label: 'Booking request', when: 'Someone asks for a time slot' },
  { key: 'consult', label: 'Free consult', when: 'Someone books a video consult' },
  { key: 'lead', label: 'Price & guide', when: 'Someone asks for the price, or a Meta lead form comes in' },
  { key: 'question', label: 'Question', when: 'Someone leaves a question for the artist' },
  { key: 'callback', label: 'Callback', when: 'Someone asks to be called' },
  { key: 'missedCall', label: 'Missed call', when: 'A call to the studio number is not answered' },
  { key: 'ownerAlert', label: 'Your alert text', when: 'Texted to you when a lead comes in' },
]

export const withDefaults = (m: Messaging = {}) => ({
  ...m,
  alerts: { push: true, sms: true, email: true, ...(m.alerts || {}) },
  autoReply: m.autoReply ?? true,
  followups: m.followups ?? true,
  missedCallTextBack: m.missedCallTextBack ?? true,
})

export const templateFor = (m: Messaging, k: TemplateKey) => (m.templates?.[k] || '').trim() || DEFAULT_TEMPLATES[k]
export const stepsFor = (m: Messaging) => (m.followupSteps?.length ? m.followupSteps : DEFAULT_FOLLOWUPS).filter((s) => s.text?.trim())

const siteOrigin = () => location.origin
export function varsFor(studio: Studio, lead: Partial<Lead>, appUrl = siteOrigin()): Record<string, string> {
  const cfg = studio.config
  const svc = cfg.services.find((s) => s.key === (lead.service || lead.quiz?.match))
  const who = cfg.team.find((t) => t.id === lead.assignedTo)
  const first = (lead.name || '').split(' ')[0]
  return {
    first: first && !/^(new|unknown|missed|texted|test)/i.test(first) ? first : 'there',
    name: lead.name || 'Someone',
    service: svc?.name || 'your treatment',
    price: svc ? '$' + svc.price.toLocaleString('en-US') : 'on our price list',
    day: lead.preferredDay || '',
    time: lead.preferredTime || '',
    when: (lead.preferredTime || 'day').toLowerCase(),
    who: who?.name?.replace(/[[\]]/g, '') || 'Someone',
    studio: cfg.name,
    artist: cfg.artist.name.replace(/[[\]]/g, ''),
    reply_time: cfg.replyTime.replace(/[[\]]/g, ''),
    link: `${appUrl}/s/${studio.slug}?src=direct`,
    source: SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS] || 'Direct',
    dashboard: `${appUrl}/app/lead/${lead.id || 'xyz'}`,
    what: 'wants the price for ' + (svc?.name || 'your treatment'),
  }
}

/** A sample lead used to preview templates in Settings. */
export const SAMPLE_LEAD: Partial<Lead> = { id: 'sample', name: 'Ana Morales', service: 'powder', preferredDay: 'Thu Oct 8', preferredTime: '11:00 AM', assignedTo: 'desk', source: 'ig-bio', quiz: {} }

/** Rough SMS segment count (160 chars, or 70 with emoji/unicode). */
export function segments(text: string) {
  const unicode = /[^\x00-\x7F’“”–—…]/.test(text)
  const per = unicode ? 67 : 153
  return text.length <= (unicode ? 70 : 160) ? 1 : Math.ceil(text.length / per)
}
