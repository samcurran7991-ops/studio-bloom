// Sample owner data for the dashboard preview (SPEC section 4) and for empty demo screens.
// Pure data, built for whichever studio you pass in (e.g. previewStudio(...)), so names always match.
// Nothing here touches the database.
import type { EventType, Followup, FunnelStep, Lead, LeadEvent, Message, Messaging, Source, Studio, TemplateKey } from './types'
import { fill, templateFor, varsFor } from './texting'

export type SampleCounts = Record<Source, Record<FunnelStep, number>>

export interface SampleOwnerData {
  leads: Lead[]
  events: LeadEvent[]
  messages: Message[]
  followups: Followup[]
  messaging: Messaging
  /** Last 30 days of studio-page traffic, for the Report screen. */
  counts: SampleCounts
}

export const SAMPLE_MESSAGING: Messaging = {
  twilioNumber: '+15550100100', forwardTo: '(555) 010-4477', ownerAlertPhone: '(555) 010-4477',
  alerts: { push: true, sms: true, email: false }, autoReply: true, followups: true, missedCallTextBack: true,
}

export function sampleOwnerData(studio: Studio, appUrl: string, now: number = Date.now()): SampleOwnerData {
  const ago = (min: number) => new Date(now - min * 60000).toISOString()
  const artist = studio.config.artist.name
  let n = 0
  const id = (p: string) => `${p}${++n}`
  const mk = (p: Partial<Lead> & { id: string; min: number }): Lead => {
    const { min, ...rest } = p
    return { studioId: studio.id, kind: 'lead', status: 'new', name: '', phone: '', source: 'direct', quiz: {}, createdAt: ago(min), updatedAt: ago(min), ...rest }
  }
  const leads: Lead[] = [
    mk({ id: 'l1', min: 38, kind: 'callback', name: 'Brooke R.', phone: '(555) 201-4410', source: 'meta-ad', campaign: 'Fall Brows · $50 off',
      quiz: { goal: 'brows', cond: 'sparse', look: 'unsure', worries: ['pain', 'fake'], match: 'combo' }, service: 'combo', preferredTime: 'Afternoon', assignedTo: 'artist' }),
    mk({ id: 'l2', min: 95, kind: 'booking', name: 'Priya K.', phone: '(555) 310-2291', source: 'ig-bio', status: 'booked',
      quiz: { goal: 'lips', cond: 'pale', look: 'natural', worries: ['heal'], match: 'lipblush' }, service: 'lipblush', preferredDay: 'Thu 8', preferredTime: '12:30 pm', assignedTo: 'desk' }),
    mk({ id: 'l3', min: 60 * 16, kind: 'lead', name: 'Ana M.', phone: '(555) 882-0193', source: 'meta-form', campaign: 'Lip Blush Lead Form',
      quiz: { goal: 'lips' }, service: 'lipblush', message: 'Interested in lip blush, what is the price?', assignedTo: 'desk', hasUnread: true }),
    mk({ id: 'l4', min: 60 * 20, kind: 'question', name: 'Dana L.', phone: '(555) 993-1034', source: 'google',
      quiz: { goal: 'brows' }, message: 'I have eczema on my forehead, can I get microblading?', assignedTo: 'owner' }),
    mk({ id: 'l5', min: 60 * 30, kind: 'lead', name: 'Maria G.', phone: '(555) 447-8812', source: 'ig-bio', status: 'contacted',
      quiz: { goal: 'fix', cond: 'colour', look: 'correct', worries: ['fake'], match: 'correct' }, service: 'correct', assignedTo: 'artist' }),
    mk({ id: 'l6', min: 60 * 44, kind: 'consult', name: 'Kayla T.', phone: '(555) 620-7745', source: 'ig-comment',
      quiz: { goal: 'brows', cond: 'gaps', look: 'powder', worries: ['suit'], match: 'powder' }, service: 'powder', preferredDay: 'Fri 9', preferredTime: '1:15 pm', assignedTo: 'artist' }),
  ]
  const ev = (leadId: string, min: number, type: EventType, text: string, chat?: LeadEvent['chat']): LeadEvent =>
    chat ? { id: id('e'), leadId, at: ago(min), type, text, chat } : { id: id('e'), leadId, at: ago(min), type, text }
  const events: LeadEvent[] = [
    ev('l1', 45, 'source', 'Clicked Meta ad "Fall Brows · $50 off"'),
    ev('l1', 44, 'quiz_done', 'Finished the 4 questions → Combo Brows'),
    ev('l1', 40, 'chat', 'Chatted with Ava', [{ from: 'visitor', text: 'Does it hurt?' }, { from: 'bot', text: 'Most clients describe it as light scratching. We apply numbing cream first…' }, { from: 'visitor', text: 'can someone call me' }]),
    ev('l1', 38, 'submitted', `Requested a callback · Afternoon · for ${artist}`),
    ev('l2', 101, 'source', 'Tapped the link in the Instagram bio'),
    ev('l2', 99, 'quiz_done', 'Finished the 4 questions → Lip Blush'),
    ev('l2', 95, 'submitted', 'Requested Lip Blush · Thu 8 at 12:30 pm'),
    ev('l2', 80, 'status', 'Marked booked · deposit taken'),
    ev('l3', 60 * 16, 'source', 'Submitted Meta lead form "Lip Blush Lead Form"'),
    ev('l4', 60 * 20 + 3, 'source', 'Tapped "Website" on the Google Business profile'),
    ev('l4', 60 * 20, 'chat', 'Asked Ava a health question → answered from the studio policy, sent to the Owner', [{ from: 'visitor', text: 'I have eczema on my forehead, can I get microblading?' }, { from: 'bot', text: 'We can\'t work on skin with an active flare-up… If your skin is calm, it\'s often fine, but we check it first…' }]),
    ev('l5', 60 * 30, 'submitted', 'Asked for the price & guide for Correction Session'),
    ev('l5', 60 * 26, 'text_logged', `${artist} texted: sent before/after photos of corrections`),
    ev('l6', 60 * 44, 'source', 'Commented "BROWS" on a reel → got the link by DM'),
    ev('l6', 60 * 43, 'submitted', 'Booked a free consult · Fri 9 at 1:15 pm'),
  ]
  const byId = new Map(leads.map((l) => [l.id, l]))
  const lead = (leadId: string): Lead => byId.get(leadId) ?? leads[0]!
  const text = (leadId: string, key: TemplateKey) => fill(templateFor(SAMPLE_MESSAGING, key), varsFor(studio, lead(leadId), appUrl))
  const msg = (leadId: string, min: number, direction: 'in' | 'out', body: string, sentBy?: string): Message => {
    const m: Message = { id: id('m'), leadId, at: ago(min), direction, body, status: direction === 'in' ? 'received' : 'delivered' }
    if (sentBy) m.sentBy = sentBy
    return m
  }
  const messages: Message[] = [
    msg('l1', 38, 'out', text('l1', 'callback'), 'auto'),
    msg('l2', 95, 'out', text('l2', 'booking'), 'auto'),
    msg('l2', 82, 'out', 'You\'re all set for Thursday at 12:30! Here\'s your deposit link to hold the time. See you soon ✨', 'you'),
    msg('l2', 81, 'in', 'Paid! Thank you so much'),
    msg('l3', 60 * 16, 'out', text('l3', 'lead'), 'auto'),
    msg('l3', 22, 'in', 'Is the touch up included in the price? And how long does it last?'),
    msg('l4', 60 * 20, 'out', text('l4', 'question'), 'auto'),
    msg('l5', 60 * 30, 'out', text('l5', 'lead'), 'auto'),
    msg('l5', 60 * 26, 'out', `Hi Maria, it's ${artist}! Here are a few corrections I did recently. Happy to look at yours on a free video consult.`, 'you'),
    msg('l6', 60 * 44, 'out', text('l6', 'consult'), 'auto'),
  ]
  const at = (l: Lead, h: number) => new Date(new Date(l.createdAt).getTime() + h * 3600e3).toISOString()
  const followups: Followup[] = [
    { leadId: 'l3', step: 0, status: 'stopped', stopReason: 'They replied' },
    { leadId: 'l4', step: 0, status: 'active', nextAt: at(lead('l4'), 24) },
    { leadId: 'l5', step: 1, status: 'active', nextAt: at(lead('l5'), 72) },
  ]
  const row = (visit: number, done: number, leadsN: number) => ({ visit, quiz_start: Math.round(done * 1.3), quiz_done: done, lead: leadsN })
  const counts: SampleCounts = {
    'ig-bio': row(412, 236, 58), 'ig-comment': row(96, 61, 22), 'ig-dm': row(0, 0, 0), 'meta-ad': row(540, 248, 71),
    'meta-form': row(0, 0, 37), google: row(88, 41, 12), direct: row(40, 18, 5),
  }
  return { leads, events, messages, followups, messaging: SAMPLE_MESSAGING, counts }
}
