import type { LeadKind, LeadStatus, NewLeadInput, Source, StudioConfig } from './types'
import { serviceByKey } from './quiz'

export const SOURCE_LABELS: Record<Source, string> = {
  'ig-bio': 'Instagram bio',
  'ig-dm': 'Instagram DM',
  'ig-comment': 'Instagram comment',
  'meta-ad': 'Meta ad',
  'meta-form': 'Meta lead form',
  google: 'Google profile',
  direct: 'Direct / other',
}
export const sourceLabel = (s: Source) => SOURCE_LABELS[s] || s
export const sourceTone = (s: Source) => (s.startsWith('ig') ? 'ig' : s.startsWith('meta') ? 'meta' : s === 'google' ? 'g' : 'site')

export const KIND_LABELS: Record<LeadKind, string> = {
  booking: 'Booking request',
  consult: 'Free consult',
  lead: 'Lead',
  question: 'Question',
  callback: 'Callback',
  chat: 'Chat',
}
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  lost: 'Not interested',
}

export function describeSubmission(cfg: StudioConfig, i: NewLeadInput): string {
  const svc = i.service ? serviceByKey(cfg, i.service)?.name ?? '' : ''
  const who = cfg.team.find((m) => m.id === i.assignedTo)?.name
  switch (i.kind) {
    case 'booking': return `Requested ${svc || 'an appointment'} · ${i.preferredDay || ''} at ${i.preferredTime || ''}`
    case 'consult': return `Booked a free consult · ${i.preferredDay || ''} at ${i.preferredTime || ''}`
    case 'callback': return `Requested a callback · ${i.preferredTime || 'any time'}${who ? ` · for ${who}` : ''}`
    case 'question': return `Asked: "${(i.message || '').slice(0, 120)}"`
    case 'lead': return `Asked for the price & guide${svc ? ` for ${svc}` : ''}`
    default: return 'Chatted with the receptionist'
  }
}

export function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}

export function clockTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? t : `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${t}`
}
