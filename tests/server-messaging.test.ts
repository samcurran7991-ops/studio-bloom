// Tests the server logic (alerts, texting, missed calls, follow-ups) against an in-memory fake of
// Supabase's REST API, so the real query strings are exercised too.  Run: bun tests/server-messaging.test.ts
import { makeDb } from '../supabase/functions/_shared/db.ts'
import { handleNewLead, handleInbound, handleMissedCall, runFollowups, ownerSend } from '../supabase/functions/_shared/core.ts'
import { validTwilioSignature, makeSendSms } from '../supabase/functions/_shared/twilio.ts'

let fails = 0, passes = 0
const ok = (cond: any, label: string) => { if (cond) passes++; else { fails++; console.log('  FAIL', label) } }

// ------------------------------------------------------------------ fake PostgREST
type Row = Record<string, any>
const T: Record<string, Row[]> = {}
const uid = () => crypto.randomUUID()
const toE164 = (p?: string) => { const d = (p || '').replace(/\D/g, ''); return d.length === 10 ? '+1' + d : d.length === 11 && d[0] === '1' ? '+' + d : p?.startsWith('+') ? '+' + d : null }
const getPath = (r: Row, col: string) => { const m = col.split('->>'); return m.length === 2 ? r[m[0]]?.[m[1]] ?? null : r[col] }
function matches(r: Row, col: string, expr: string) {
  const [op, ...rest] = expr.split('.'); const v = decodeURIComponent(rest.join('.'))
  const x = getPath(r, col)
  if (op === 'eq') return String(x) === v
  if (op === 'lte') return x != null && new Date(x) <= new Date(v)
  if (op === 'in') return v.replace(/[()]/g, '').split(',').includes(String(x))
  throw new Error('op ' + op)
}
function filter(table: string, qs: URLSearchParams) {
  let rows = (T[table] ||= [])
  let order = '', limit = Infinity
  for (const [k, v] of qs) {
    if (k === 'select' || k === 'on_conflict') continue
    if (k === 'order') { order = v; continue }
    if (k === 'limit') { limit = Math.min(limit, +v); continue }
    rows = rows.filter((r) => matches(r, k, v))
  }
  if (order) { const [c, dir] = order.split('.'); rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (dir === 'desc' ? -1 : 1)) }
  return rows.slice(0, limit)
}
const queryLog: string[] = []
function submitLead(args: any) {
  const s = T.studios.find((x) => x.slug === args.p_slug)!
  const l = args.p_lead
  const row = { id: uid(), studio_id: s.id, kind: l.kind, name: l.name, phone: l.phone, phone_e164: toE164(l.phone), source: l.source, message: l.message, quiz: l.quiz || {}, status: 'new', assigned_to: l.assignedTo || 'desk', created_at: new Date().toISOString(), has_unread: false }
  T.leads.push(row); return row.id
}
const fakeFetch = (async (input: any, init: any = {}) => {
  const u = new URL(String(input)); const path = u.pathname.replace('/rest/v1/', ''); const qs = u.searchParams
  queryLog.push(`${init.method || 'GET'} ${path}?${u.search.slice(1)}`)
  const body = init.body ? JSON.parse(init.body) : null
  const res = (d: any) => new Response(JSON.stringify(d), { status: 200 })
  if (path.startsWith('rpc/')) { if (path === 'rpc/submit_lead') return res(submitLead(body)); throw new Error(path) }
  const t = (T[path] ||= [])
  switch (init.method || 'GET') {
    case 'GET': return res(filter(path, qs))
    case 'POST': {
      const conflict = qs.get('on_conflict')?.split(',')
      const out: Row[] = []
      for (const r of body) {
        if (conflict && t.some((x) => conflict.every((c) => x[c] === r[c]))) continue // ignore-duplicates
        const row = { id: uid(), created_at: new Date().toISOString(), ...r }; t.push(row); out.push(row)
      }
      return res(out)
    }
    case 'PATCH': { const rows = filter(path, qs); rows.forEach((r) => Object.assign(r, body)); return res(rows) }
    case 'DELETE': { const rows = filter(path, qs); T[path] = t.filter((r) => !rows.includes(r)); return res(rows) }
  }
  throw new Error('method')
}) as typeof fetch

// ------------------------------------------------------------------ fixtures
const STUDIO_NUM = '+16615550100'
function reset(messaging: any = {}) {
  for (const k of Object.keys(T)) delete T[k]
  T.studios = [{ id: 's1', slug: 'arch-and-ink', config: { name: 'Arch & Ink', artist: { name: 'Maya' }, replyTime: '2 hours', services: [{ key: 'powder', name: 'Powder Brows', price: 550 }], team: [{ id: 'desk', name: 'Front desk' }, { id: 'owner', name: 'Maya' }] },
    messaging: { twilioNumber: STUDIO_NUM, ownerAlertPhone: '(661) 555-0199', ownerAlertEmail: 'maya@example.com', ...messaging } }]
  T.studio_members = [{ studio_id: 's1', user_id: 'u-owner' }]
  T.leads = []; T.messages = []; T.followups = []; T.opt_outs = []; T.lead_events = []
  T.push_subscriptions = [{ studio_id: 's1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a' }, { studio_id: 's1', endpoint: 'https://push/gone', p256dh: 'k', auth: 'a' }]
}
let sms: { to: string; from: string; body: string }[] = [], pushes: any[] = [], emails: any[] = []
let clock = new Date('2026-10-01T15:00:00Z')
const deps = () => ({
  db: makeDb('https://x.supabase.co', 'svc', fakeFetch),
  sms: async (to: string, from: string, body: string) => { sms.push({ to, from, body }); return { ok: true, sid: 'SM' + sms.length } },
  push: async (subs: any[], p: any) => { pushes.push(p); return subs.filter((s) => s.endpoint.includes('gone')).map((s) => s.endpoint) },
  email: async (to: string, subject: string, text: string) => { emails.push({ to, subject, text }); return true },
  appUrl: 'https://app.test', now: () => clock,
})
const clear = () => { sms = []; pushes = []; emails = [] }
function addLead(p: Partial<Row>) {
  const row = { id: uid(), studio_id: 's1', kind: 'lead', name: 'Ana Morales', phone: '(661) 555-0123', source: 'ig-bio', quiz: { match: 'powder' }, status: 'new', assigned_to: 'desk', created_at: clock.toISOString(), ...p }
  ;(row as any).phone_e164 = toE164(row.phone); T.leads.push(row); return row
}

// ------------------------------------------------------------------ 1. new lead
console.log('handleNewLead')
reset(); clear()
let lead = addLead({ kind: 'lead' })
let r: any = await handleNewLead(deps() as any, lead.id)
ok(r.ok, 'ok')
ok(pushes.length === 1 && pushes[0].title === 'New lead: Ana Morales', 'push sent with name')
ok(!T.push_subscriptions.some((s) => s.endpoint.includes('gone')), 'dead push subscription removed')
ok(sms.some((s) => s.to === '+16615550199' && s.body.startsWith('New lead (Instagram bio): Ana Morales')), 'owner alert text')
ok(emails.length === 1 && emails[0].to === 'maya@example.com', 'owner email')
const reply = sms.find((s) => s.to === '+16615550123')
ok(reply && reply.from === STUDIO_NUM && reply.body.includes('Hi Ana') && reply.body.includes('Powder Brows is $550') && reply.body.includes('https://app.test/s/arch-and-ink'), 'instant reply content: ' + reply?.body)
ok(T.messages.filter((m) => m.sent_by === 'auto' && m.status === 'sent').length === 1, 'reply logged in thread')
ok(T.followups.length === 1 && T.followups[0].next_at === new Date(clock.getTime() + 24 * 3600e3).toISOString(), 'follow-up scheduled 24h')
ok(T.lead_events.some((e) => e.text.includes('Owner alerted by app notification, text, email')), 'alert event logged')
// run again: no second reply, no duplicate followup
clear(); await handleNewLead(deps() as any, lead.id)
ok(!sms.some((s) => s.to === '+16615550123'), 'no duplicate instant reply')
ok(T.followups.length === 1, 'no duplicate follow-up row')
// booking: reply, but no follow-ups
clear(); const book = addLead({ kind: 'booking', name: 'Jo Lee', phone: '6615550124', preferred_day: 'Thu Oct 8', preferred_time: '11:00 AM', service: 'powder' })
await handleNewLead(deps() as any, book.id)
ok(sms.some((s) => s.body.includes('Powder Brows on Thu Oct 8 at 11:00 AM')), 'booking reply')
ok(!T.followups.some((f) => f.lead_id === book.id), 'no follow-ups for bookings')
// origin skip
clear(); const sl = addLead({ quiz: { origin: 'sms' } }); r = await handleNewLead(deps() as any, sl.id)
ok(r.skipped === 'sms' && sms.length === 0 && pushes.length === 0, 'origin leads skipped')
// no texting number: alerts by push/email only, no texts
reset({ twilioNumber: '' }); clear(); lead = addLead({}); r = await handleNewLead(deps() as any, lead.id)
ok(sms.length === 0 && pushes.length === 1 && emails.length === 1 && T.followups.length === 0, 'without a number: push+email only')
// alert toggles
reset({ alerts: { sms: false, email: false } }); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id)
ok(!sms.some((s) => s.to === '+16615550199') && emails.length === 0 && pushes.length === 1, 'alert toggles respected')
// autoReply off
reset({ autoReply: false }); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id)
ok(!sms.some((s) => s.to === '+16615550123'), 'autoReply off')
// custom template
reset({ templates: { lead: 'Yo {first}, {service} = {price}' } }); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id)
ok(sms.some((s) => s.body === 'Yo Ana, Powder Brows = $550'), 'custom template used')

// ------------------------------------------------------------------ 2. inbound
console.log('handleInbound')
reset(); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id); clear()
r = await handleInbound(deps() as any, { from: '+16615550123', to: STUDIO_NUM, body: 'How long does it last?', sid: 'SMin1' })
ok(r.ok && r.leadId === lead.id, 'matched to existing lead')
ok(T.messages.some((m) => m.direction === 'in' && m.body === 'How long does it last?'), 'inbound stored')
ok(lead.has_unread === true, 'marked unread')
ok(T.followups[0].status === 'stopped' && T.followups[0].stop_reason === 'They replied', 'follow-ups paused on reply')
ok(pushes[0]?.title === 'Ana Morales replied', 'owner push: replied')
ok(sms.some((s) => s.to === '+16615550199' && s.body.includes('How long does it last?')), 'owner text alert on reply')
// new texter
clear(); r = await handleInbound(deps() as any, { from: '+16615550777', to: STUDIO_NUM, body: 'Do you do lip blush?' })
const nl = T.leads.find((l) => l.id === r.leadId)
ok(nl && nl.quiz.origin === 'sms' && nl.kind === 'chat', 'new texter creates a lead')
ok(pushes[0]?.title === 'New text from +16615550777', 'new texter alert')
// STOP
reset(); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id); clear()
r = await handleInbound(deps() as any, { from: '+16615550123', to: STUDIO_NUM, body: ' stop ' })
ok(r.optedOut && T.opt_outs.length === 1, 'STOP recorded')
ok(T.followups[0].status === 'stopped', 'STOP stops follow-ups')
ok(pushes.length === 0 && sms.length === 0, 'no alert for STOP')
r = await ownerSend(deps() as any, 'u-owner', lead.id, 'Hi again')
ok(!r.ok && /STOP/.test(r.error) && T.messages.some((m) => m.status === 'blocked'), 'cannot text after STOP')
await handleInbound(deps() as any, { from: '+16615550123', to: STUDIO_NUM, body: 'START' })
ok(T.opt_outs.length === 0, 'START removes opt-out')
r = await handleInbound(deps() as any, { from: '+1999', to: '+10000000000', body: 'hi' })
ok(!r.ok, 'unknown number rejected')

// ------------------------------------------------------------------ 3. missed call
console.log('handleMissedCall')
reset(); clear()
r = await handleMissedCall(deps() as any, { from: '+16615550888', to: STUDIO_NUM })
ok(r.ok && r.texted, 'text-back sent')
ok(sms.some((s) => s.to === '+16615550888' && s.body.startsWith('Sorry we missed your call! This is Arch & Ink')), 'text-back content')
ok(pushes[0]?.title === 'Missed call from +16615550888' && pushes[0].body.includes('texted them back'), 'owner alerted')
ok(T.leads[0].kind === 'callback' && T.leads[0].quiz.origin === 'missed-call', 'callback lead created')
clear(); r = await handleMissedCall(deps() as any, { from: '(661) 555-0888', to: STUDIO_NUM })
ok(T.leads.length === 1 && r.leadId === T.leads[0].id, 'second call reuses lead')
reset({ missedCallTextBack: false }); clear(); r = await handleMissedCall(deps() as any, { from: '+16615550888', to: STUDIO_NUM })
ok(!r.texted && !sms.some((s) => s.to === '+16615550888') && pushes.length === 1, 'text-back off still alerts')

// ------------------------------------------------------------------ 4. follow-ups
console.log('runFollowups')
reset(); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id); clear()
r = await runFollowups(deps() as any); ok(r.due === 0, 'nothing due yet')
clock = new Date(clock.getTime() + 25 * 3600e3)
r = await runFollowups(deps() as any)
ok(r.sent === 1 && sms[0].body.includes('healed Powder Brows results'), 'step 1 sent')
ok(T.followups[0].step === 1 && T.followups[0].status === 'active', 'advanced to step 2')
clock = new Date(clock.getTime() + 48 * 3600e3); clear(); await runFollowups(deps() as any)
ok(sms[0]?.body.includes("it's Maya from Arch & Ink"), 'step 2 sent')
clock = new Date(clock.getTime() + 100 * 3600e3); clear(); await runFollowups(deps() as any)
ok(sms.length === 1 && T.followups[0].status === 'done', 'step 3 sent, sequence done')
clear(); r = await runFollowups(deps() as any); ok(r.due === 0 && sms.length === 0, 'no more after done')
// booked -> stop
reset(); clock = new Date('2026-10-01T15:00:00Z'); clear(); lead = addLead({}); await handleNewLead(deps() as any, lead.id); clear()
lead.status = 'booked'; clock = new Date(clock.getTime() + 25 * 3600e3)
await runFollowups(deps() as any)
ok(sms.length === 0 && T.followups[0].status === 'stopped', 'booked lead stops sequence')

// ------------------------------------------------------------------ 5. owner send
console.log('ownerSend')
reset(); clear(); lead = addLead({})
r = await ownerSend(deps() as any, 'stranger', lead.id, 'hello'); ok(!r.ok && /access/.test(r.error), 'non-member blocked')
r = await ownerSend(deps() as any, 'u-owner', lead.id, '   '); ok(!r.ok, 'empty blocked')
r = await ownerSend(deps() as any, 'u-owner', lead.id, 'Hi Ana, Thursday works!')
ok(r.ok && sms[0].to === '+16615550123' && sms[0].from === STUDIO_NUM, 'sent from studio number')
ok(lead.status === 'contacted' && T.messages.some((m) => m.sent_by === 'u-owner'), 'marked contacted + logged')

// ------------------------------------------------------------------ query shapes
ok(queryLog.some((q) => q.includes('messaging-%3E%3EtwilioNumber') || q.includes('messaging->>twilioNumber=eq.%2B16615550100')), 'JSON filter shape: ' + queryLog.find((q) => q.includes('twilioNumber')))

// ------------------------------------------------------------------ Twilio
console.log('twilio')
// Twilio's published example (docs: "Validating signatures")
const sigOk = await validTwilioSignature('https://mycompany.com/myapp.php?foo=1&bar=2',
  { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' },
  '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', '12345')
ok(sigOk, 'Twilio example signature validates')
ok(!(await validTwilioSignature('https://mycompany.com/myapp.php?foo=1&bar=2', { From: 'x' }, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', '12345')), 'tampered rejected')
process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 't'; process.env.FUNCTIONS_URL = 'https://f.test/functions/v1'
let sent: any
const s2 = makeSendSms((async (u: any, i: any) => { sent = { u: String(u), b: new URLSearchParams(i.body) }; return new Response(JSON.stringify({ sid: 'SMx' }), { status: 201 }) }) as any)
const rr = await s2('+16615550123', STUDIO_NUM, 'hi')
ok(rr.ok && rr.sid === 'SMx' && sent.u.includes('/Accounts/AC1/Messages.json') && sent.b.get('StatusCallback') === 'https://f.test/functions/v1/twilio-status', 'sendSms request shape')

console.log(`\n${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
