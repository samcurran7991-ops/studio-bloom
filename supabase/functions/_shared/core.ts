// Business logic for alerts, texting, missed calls and follow-ups.
// Every outside service is passed in (deps), so this file is tested without real Twilio/Supabase.
import type { Db } from './db.ts'
import { eq } from './db.ts'
import type { SendSms } from './twilio.ts'
import { DEFAULT_FOLLOWUPS, DEFAULT_TEMPLATES, FOLLOWUP_KINDS, START_WORDS, STOP_WORDS, fill, type FollowupStep, type TemplateKey } from './templates.ts'

export interface PushPayload { title: string; body: string; url: string; tag?: string }
export interface Deps {
  db: Db
  sms: SendSms
  /** Sends a web push to each subscription; returns endpoints that are gone (to delete). */
  push: (subs: { endpoint: string; p256dh: string; auth: string }[], payload: PushPayload) => Promise<string[]>
  email: (to: string, subject: string, text: string) => Promise<boolean>
  appUrl: string // e.g. https://app.yourbrand.com
  now?: () => Date
  /** Outside HTTP calls (Instagram / Meta / Google APIs). Injected so tests can fake them. */
  http?: typeof fetch
  /** App ids, secrets and API versions for the account connections (see connect.ts). */
  cfg?: import('./connect.ts').ConnectConfig
}

export interface Messaging {
  twilioNumber?: string
  forwardTo?: string
  ownerAlertPhone?: string
  ownerAlertEmail?: string
  alerts?: { push?: boolean; sms?: boolean; email?: boolean }
  autoReply?: boolean
  followups?: boolean
  missedCallTextBack?: boolean
  callSource?: string
  templates?: Partial<Record<TemplateKey, string>>
  followupSteps?: FollowupStep[]
  /** Instagram: reply to the first DM of a new conversation automatically. */
  igAutoReply?: boolean
  igWelcome?: string
  /** Instagram: comment keywords that get the link by DM, e.g. [{ word: 'BROWS' }]. */
  igKeywords?: { word: string; reply?: string }[]
}

const SOURCE_LABELS: Record<string, string> = {
  'ig-bio': 'Instagram bio', 'ig-dm': 'Instagram DM', 'ig-comment': 'Instagram comment',
  'meta-ad': 'Meta ad', 'meta-form': 'Meta lead form', google: 'Google', direct: 'Direct',
}

export const toE164 = (p?: string | null): string | null => {
  if (!p) return null
  const d = p.replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d[0] === '1') return '+' + d
  if (p.trim().startsWith('+') && d.length >= 8) return '+' + d
  return null
}

export function settings(studio: any): Required<Pick<Messaging, 'alerts' | 'autoReply' | 'followups' | 'missedCallTextBack'>> & Messaging {
  const m: Messaging = studio?.messaging || {}
  return {
    ...m,
    alerts: { push: true, sms: true, email: true, ...(m.alerts || {}) },
    autoReply: m.autoReply ?? true,
    followups: m.followups ?? true,
    missedCallTextBack: m.missedCallTextBack ?? true,
  }
}
const template = (m: Messaging, k: TemplateKey) => (m.templates?.[k] || '').trim() || DEFAULT_TEMPLATES[k]
const steps = (m: Messaging) => (m.followupSteps?.length ? m.followupSteps : DEFAULT_FOLLOWUPS).filter((s) => s.text?.trim())

export function varsFor(studio: any, lead: any, appUrl: string): Record<string, string> {
  const cfg = studio.config || {}
  const svc = (cfg.services || []).find((s: any) => s.key === (lead.service || lead.quiz?.match))
  const who = (cfg.team || []).find((t: any) => t.id === lead.assigned_to)
  const first = (lead.name || '').replace(/^@/, '').split(' ')[0]
  return {
    first: first && !/^(new|unknown|missed|texted)/i.test(first) && !(lead.ig_username && lead.name?.startsWith('@')) ? first : 'there',
    name: lead.name || 'Someone',
    service: svc?.name || 'your treatment',
    price: svc ? '$' + Number(svc.price).toLocaleString('en-US') : 'on our price list',
    day: lead.preferred_day || '',
    time: lead.preferred_time || '',
    when: (lead.preferred_time || 'day').toLowerCase(),
    who: who?.name?.replace(/[[\]]/g, '') || 'Someone',
    studio: cfg.name || 'the studio',
    artist: cfg.artist?.name || 'the artist',
    reply_time: (cfg.replyTime || 'a few hours').replace(/[[\]]/g, ''),
    link: `${appUrl}/s/${studio.slug}?src=direct`,
    source: SOURCE_LABELS[lead.source] || lead.source || 'Direct',
    dashboard: `${appUrl}/app/lead/${lead.id}`,
  }
}

function whatTheyWant(lead: any, v: Record<string, string>): string {
  switch (lead.kind) {
    case 'booking': return `wants ${v.service} ${v.day} ${v.time}`.trim()
    case 'consult': return `booked a free consult ${v.day} ${v.time}`.trim()
    case 'callback': return `wants a callback (${v.when})`
    case 'question': return `asked: "${(lead.message || '').slice(0, 80)}"`
    case 'lead': return lead.message ? `"${lead.message.slice(0, 80)}"` : `wants the price for ${v.service}`
    default: return lead.message ? `"${lead.message.slice(0, 80)}"` : 'sent a message'
  }
}

async function optedOut(db: Db, studioId: string, phone: string | null) {
  if (!phone) return true
  return Boolean(await db.one('opt_outs', `studio_id=${eq(studioId)}&phone_e164=${eq(phone)}`))
}

export async function logEvent(db: Db, lead: any, type: string, text: string) {
  await db.insert('lead_events', [{ lead_id: lead.id, studio_id: lead.studio_id, type, text: text.slice(0, 2000) }])
}

/** Sends a text to a lead and records it in the thread. */
async function textLead(d: Deps, studio: any, lead: any, body: string, sentBy: string) {
  const m = settings(studio)
  const to = lead.phone_e164 || toE164(lead.phone)
  if (!m.twilioNumber) return { ok: false, error: 'No studio texting number' }
  if (await optedOut(d.db, studio.id, to)) {
    await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', body, status: 'blocked', sent_by: sentBy, error: 'Opted out (STOP)' }])
    return { ok: false, error: 'This person replied STOP, so they can\'t be texted' }
  }
  const r = await d.sms(to!, m.twilioNumber, body)
  await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', body, status: r.ok ? 'sent' : 'failed', sent_by: sentBy, provider_id: r.sid ?? null, error: r.error ?? null }])
  await d.db.update('leads', `id=${eq(lead.id)}`, { last_message_at: (d.now?.() || new Date()).toISOString() })
  return r
}

export async function alertOwner(d: Deps, studio: any, payload: PushPayload, smsText: string, emailSubject: string) {
  const m = settings(studio)
  const done: string[] = []
  if (m.alerts.push) {
    const subs = await d.db.select('push_subscriptions', `studio_id=${eq(studio.id)}&select=endpoint,p256dh,auth`)
    if (subs.length) {
      const gone = await d.push(subs, payload)
      for (const ep of gone) await d.db.remove('push_subscriptions', `endpoint=${eq(ep)}`)
      if (gone.length < subs.length) done.push('app notification')
    }
  }
  if (m.alerts.sms && m.ownerAlertPhone && m.twilioNumber) {
    const r = await d.sms(toE164(m.ownerAlertPhone) || m.ownerAlertPhone, m.twilioNumber, smsText)
    if (r.ok) done.push('text')
  }
  if (m.alerts.email && m.ownerAlertEmail) {
    if (await d.email(m.ownerAlertEmail, emailSubject, smsText)) done.push('email')
  }
  return done
}

export async function loadStudio(db: Db, id: string) {
  return db.one('studios', `id=${eq(id)}&select=id,slug,config,messaging`)
}

/** Sends an Instagram DM to a lead (only allowed within 24 hours of their last message). */
export async function sendInstagram(d: Deps, studio: any, lead: any, body: string, sentBy: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const { igSend } = await import('./connect.ts')
  const lastIn = await d.db.one('messages', `lead_id=${eq(lead.id)}&direction=eq.in&channel=eq.instagram&order=created_at.desc&select=created_at`)
  const now = (d.now?.() || new Date()).getTime()
  if (!lastIn || now - new Date(lastIn.created_at).getTime() > 24 * 3600e3) {
    return { ok: false, error: 'Instagram only allows replies within 24 hours of their last message. Reply in the Instagram app, or ask for their number.' }
  }
  const r = await igSend(d, studio.id, { id: lead.ig_user_id }, body)
  await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', channel: 'instagram', body, status: r.ok ? 'sent' : 'failed', sent_by: sentBy, provider_id: r.sid ?? null, error: r.error ?? null }])
  await d.db.update('leads', `id=${eq(lead.id)}`, { last_message_at: new Date(now).toISOString() })
  return r
}

// ---------------------------------------------------------------- 1. a new lead arrived
export async function handleNewLead(d: Deps, leadId: string) {
  const lead = await d.db.one('leads', `id=${eq(leadId)}`)
  if (!lead) return { ok: false, error: 'Lead not found' }
  // Leads created by an incoming text or a missed call are handled by those flows.
  if (lead.quiz?.origin) return { ok: true, skipped: lead.quiz.origin }
  const studio = await loadStudio(d.db, lead.studio_id)
  const m = settings(studio)
  const v = varsFor(studio, lead, d.appUrl)
  const result: Record<string, unknown> = {}

  // Owner alert
  const alertText = fill(template(m, 'ownerAlert'), { ...v, what: whatTheyWant(lead, v) })
  const alerted = await alertOwner(d, studio, { title: `New lead: ${v.name}`, body: `${whatTheyWant(lead, v)} · ${v.source}`, url: `/app/lead/${lead.id}`, tag: lead.id }, alertText, `New lead: ${v.name} (${v.source})`)
  result.alerted = alerted
  if (alerted.length) await logEvent(d.db, lead, 'auto', `Owner alerted by ${alerted.join(', ')}`)

  // Instant reply (once per lead)
  const already = await d.db.one('messages', `lead_id=${eq(lead.id)}&sent_by=eq.auto`)
  if (m.autoReply && m.twilioNumber && lead.kind !== 'chat' && !already) {
    const key = (['booking', 'consult', 'lead', 'question', 'callback'].includes(lead.kind) ? lead.kind : 'lead') as TemplateKey
    const r = await textLead(d, studio, lead, fill(template(m, key), v), 'auto')
    result.reply = r
    await logEvent(d.db, lead, 'auto', r.ok ? 'Instant text sent' : `Instant text not sent: ${r.error}`)
  }

  // Follow-up sequence
  const seq = steps(m)
  if (m.followups && m.twilioNumber && FOLLOWUP_KINDS.includes(lead.kind) && seq.length) {
    const start = new Date(lead.created_at).getTime()
    await d.db.upsert('followups', [{ studio_id: studio.id, lead_id: lead.id, step: 0, next_at: new Date(start + seq[0].afterHours * 3600e3).toISOString(), status: 'active' }], 'lead_id')
    result.followups = true
  }
  return { ok: true, ...result }
}

// ---------------------------------------------------------------- 2. someone texted the studio number
export async function handleInbound(d: Deps, p: { from: string; to: string; body: string; sid?: string }) {
  const studio = await d.db.one('studios', `messaging->>twilioNumber=${eq(p.to)}&select=id,slug,config,messaging`)
  if (!studio) return { ok: false, error: 'No studio uses this number' }
  const from = toE164(p.from) || p.from
  const word = p.body.trim().toUpperCase()

  if (STOP_WORDS.includes(word)) {
    await d.db.upsert('opt_outs', [{ studio_id: studio.id, phone_e164: from }], 'studio_id,phone_e164')
    await d.db.update('followups', `studio_id=${eq(studio.id)}&status=eq.active&lead_id=in.(${(await d.db.select('leads', `studio_id=${eq(studio.id)}&phone_e164=${eq(from)}&select=id`)).map((l: any) => l.id).join(',') || '00000000-0000-0000-0000-000000000000'})`, { status: 'stopped', stop_reason: 'Replied STOP' })
  } else if (START_WORDS.includes(word)) {
    await d.db.remove('opt_outs', `studio_id=${eq(studio.id)}&phone_e164=${eq(from)}`)
  }

  let lead = await d.db.one('leads', `studio_id=${eq(studio.id)}&phone_e164=${eq(from)}&order=created_at.desc`)
  const isNew = !lead
  if (!lead) {
    const id = await d.db.rpc('submit_lead', { p_slug: studio.slug, p_lead: { kind: 'chat', name: 'New texter', phone: from, source: 'direct', message: p.body.slice(0, 2000), quiz: { origin: 'sms' } } })
    lead = await d.db.one('leads', `id=${eq(id)}`)
  }
  await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'in', body: p.body.slice(0, 1600), status: 'received', provider_id: p.sid ?? null }])
  await d.db.update('leads', `id=${eq(lead.id)}`, { has_unread: true, last_message_at: (d.now?.() || new Date()).toISOString() })
  // A reply means a human conversation: pause the automatic follow-ups.
  await d.db.update('followups', `lead_id=${eq(lead.id)}&status=eq.active`, { status: 'stopped', stop_reason: 'They replied' })

  if (!STOP_WORDS.includes(word)) {
    const v = varsFor(studio, lead, d.appUrl)
    const title = isNew ? `New text from ${p.from}` : `${v.name} replied`
    await alertOwner(d, studio, { title, body: p.body.slice(0, 120), url: `/app/lead/${lead.id}`, tag: lead.id }, `${title}: "${p.body.slice(0, 100)}" Open: ${v.dashboard}`, title)
  }
  return { ok: true, leadId: lead.id, optedOut: STOP_WORDS.includes(word) }
}

// ---------------------------------------------------------------- 3. a call to the studio number went unanswered
export async function handleMissedCall(d: Deps, p: { from: string; to: string }) {
  const studio = await d.db.one('studios', `messaging->>twilioNumber=${eq(p.to)}&select=id,slug,config,messaging`)
  if (!studio) return { ok: false, error: 'No studio uses this number' }
  const m = settings(studio)
  const from = toE164(p.from) || p.from
  let lead = await d.db.one('leads', `studio_id=${eq(studio.id)}&phone_e164=${eq(from)}&order=created_at.desc`)
  if (!lead) {
    const id = await d.db.rpc('submit_lead', { p_slug: studio.slug, p_lead: { kind: 'callback', name: 'Missed caller', phone: from, source: m.callSource || 'direct', message: 'Called the studio and nobody answered', quiz: { origin: 'missed-call' } } })
    lead = await d.db.one('leads', `id=${eq(id)}`)
  } else {
    await logEvent(d.db, lead, 'auto', 'Called the studio and nobody answered')
    await d.db.update('leads', `id=${eq(lead.id)}`, { has_unread: true })
  }
  let texted = false
  if (m.missedCallTextBack && m.twilioNumber) {
    const r = await textLead(d, studio, lead, fill(template(m, 'missedCall'), varsFor(studio, lead, d.appUrl)), 'auto')
    texted = r.ok
    await logEvent(d.db, lead, 'auto', r.ok ? 'Missed-call text-back sent' : `Missed-call text-back not sent: ${r.error}`)
  }
  const v = varsFor(studio, lead, d.appUrl)
  await alertOwner(d, studio, { title: `Missed call from ${p.from}`, body: texted ? 'We texted them back automatically.' : 'Call them back when you can.', url: `/app/lead/${lead.id}`, tag: lead.id },
    `Missed call from ${p.from}.${texted ? ' We texted them back.' : ''} Open: ${v.dashboard}`, `Missed call from ${p.from}`)
  return { ok: true, leadId: lead.id, texted }
}

// ---------------------------------------------------------------- 4. scheduled: send due follow-ups
export async function runFollowups(d: Deps, limit = 50) {
  const now = d.now?.() || new Date()
  const due = await d.db.select('followups', `status=eq.active&next_at=lte.${encodeURIComponent(now.toISOString())}&order=next_at&limit=${limit}`)
  let sent = 0
  for (const f of due) {
    const lead = await d.db.one('leads', `id=${eq(f.lead_id)}`)
    const studio = await loadStudio(d.db, f.studio_id)
    const m = settings(studio)
    const seq = steps(m)
    if (!lead || !m.followups || ['booked', 'lost'].includes(lead.status)) {
      await d.db.update('followups', `id=${eq(f.id)}`, { status: 'stopped', stop_reason: !lead ? 'Lead removed' : !m.followups ? 'Follow-ups turned off' : `status: ${lead.status}` })
      continue
    }
    const step = seq[f.step]
    if (!step) { await d.db.update('followups', `id=${eq(f.id)}`, { status: 'done', next_at: null }); continue }
    const r = await textLead(d, studio, lead, fill(step.text, varsFor(studio, lead, d.appUrl)), 'followup')
    await logEvent(d.db, lead, 'auto', r.ok ? `Follow-up ${f.step + 1} of ${seq.length} sent` : `Follow-up ${f.step + 1} not sent: ${r.error}`)
    if (r.ok) sent++
    const next = seq[f.step + 1]
    if (!r.ok && /STOP/.test(r.error || '')) {
      await d.db.update('followups', `id=${eq(f.id)}`, { status: 'stopped', stop_reason: 'Opted out' })
    } else if (next) {
      await d.db.update('followups', `id=${eq(f.id)}`, { step: f.step + 1, next_at: new Date(new Date(lead.created_at).getTime() + next.afterHours * 3600e3).toISOString() })
    } else {
      await d.db.update('followups', `id=${eq(f.id)}`, { step: f.step + 1, status: 'done', next_at: null })
    }
  }
  return { ok: true, due: due.length, sent }
}

// ---------------------------------------------------------------- 5. the owner sends a text from the dashboard
export async function ownerSend(d: Deps, userId: string, leadId: string, body: string) {
  const text = body.trim()
  if (!text) return { ok: false, error: 'Write a message first' }
  if (text.length > 1600) return { ok: false, error: 'That message is too long (1,600 characters max)' }
  const lead = await d.db.one('leads', `id=${eq(leadId)}`)
  if (!lead) return { ok: false, error: 'Lead not found' }
  const member = await d.db.one('studio_members', `studio_id=${eq(lead.studio_id)}&user_id=${eq(userId)}`)
  if (!member) return { ok: false, error: 'You don\'t have access to this lead' }
  const studio = await loadStudio(d.db, lead.studio_id)
  const viaInstagram = !(lead.phone_e164 || toE164(lead.phone)) && lead.ig_user_id
  const r = viaInstagram ? await sendInstagram(d, studio, lead, text, userId) : await textLead(d, studio, lead, text, userId)
  if (r.ok) {
    await d.db.update('leads', `id=${eq(lead.id)}`, { has_unread: false, ...(lead.status === 'new' ? { status: 'contacted' } : {}) })
    await d.db.update('followups', `lead_id=${eq(lead.id)}&status=eq.active`, { status: 'stopped', stop_reason: 'Owner is texting them directly' })
  }
  return r
}
