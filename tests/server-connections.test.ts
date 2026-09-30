// Tests the one-tap connections against fakes of Supabase's REST API, Meta Graph, Instagram and Google.
// Run: bun tests/server-connections.test.ts
import { makeDb } from '../supabase/functions/_shared/db.ts'
import { ownerSend } from '../supabase/functions/_shared/core.ts'
import { finishConnect, googleAction, handleDeauthorize, handleMetaWebhook, parseSignedRequest, refreshTokens, startConnect, validMetaSignature, type ConnectConfig } from '../supabase/functions/_shared/connect.ts'

let fails = 0, passes = 0
const ok = (cond: any, label: string) => { if (cond) passes++; else { fails++; console.log('  FAIL', label) } }

// ------------------------------------------------------------------ fake PostgREST
type Row = Record<string, any>
const T: Record<string, Row[]> = {}
const uid = () => crypto.randomUUID()
const toE164 = (p?: string | null) => { const d = (p || '').replace(/\D/g, ''); return d.length === 10 ? '+1' + d : d.length === 11 && d[0] === '1' ? '+' + d : null }
const getPath = (r: Row, col: string) => { const m = col.split('->>'); return m.length === 2 ? r[m[0]]?.[m[1]] ?? null : r[col] }
function matches(r: Row, col: string, expr: string) {
  const [op, ...rest] = expr.split('.'); const v = decodeURIComponent(rest.join('.'))
  const x = getPath(r, col)
  if (op === 'eq') return x != null && String(x) === v
  if (op === 'neq') return String(x) !== v
  if (op === 'lte') return x != null && new Date(x) <= new Date(v)
  if (op === 'in') return v.replace(/[()]/g, '').split(',').includes(String(x))
  if (op === 'cs') { const want = v.replace(/[{}]/g, '').split(','); return Array.isArray(x) && want.every((w) => x.map(String).includes(w)) }
  throw new Error('op ' + op)
}
function filter(table: string, qs: URLSearchParams) {
  let rows = (T[table] ||= [])
  let order = '', limit = Infinity
  for (const [k, v] of qs) {
    if (['select', 'on_conflict'].includes(k)) continue
    if (k === 'order') { order = v; continue }
    if (k === 'limit') { limit = Math.min(limit, +v); continue }
    rows = rows.filter((r) => matches(r, k, v))
  }
  if (order) { const [c, dir] = order.split('.'); rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (dir === 'desc' ? -1 : 1)) }
  return rows.slice(0, limit)
}
function submitLead(args: any) {
  const s = T.studios.find((x) => x.slug === args.p_slug)!
  const l = args.p_lead
  const row = { id: uid(), studio_id: s.id, kind: l.kind, name: l.name, phone: l.phone, phone_e164: toE164(l.phone), email: l.email, source: l.source, campaign: l.campaign, message: l.message, quiz: l.quiz || {}, status: 'new', assigned_to: l.assignedTo, created_at: new Date().toISOString() }
  T.leads.push(row); return row.id
}
const dbFetch = (async (input: any, init: any = {}) => {
  const u = new URL(String(input)); const path = u.pathname.replace('/rest/v1/', ''); const qs = u.searchParams
  const body = init.body ? JSON.parse(init.body) : null
  const res = (d: any) => new Response(JSON.stringify(d), { status: 200 })
  if (path === 'rpc/submit_lead') return res(submitLead(body))
  const t = (T[path] ||= [])
  switch (init.method || 'GET') {
    case 'GET': return res(filter(path, qs))
    case 'POST': { const out = body.map((r: Row) => { const row = { id: uid(), created_at: clock.toISOString(), ...r }; if (path === 'leads') row.phone_e164 = toE164(row.phone); t.push(row); return row }); return res(out) }
    case 'PATCH': { const rows = filter(path, qs); rows.forEach((r) => Object.assign(r, body)); return res(rows) }
    case 'DELETE': { const rows = filter(path, qs); T[path] = t.filter((r) => !rows.includes(r)); return res(rows) }
  }
  throw new Error('method')
}) as typeof fetch

// ------------------------------------------------------------------ fake Meta / Instagram / Google
const calls: { url: string; method: string; body?: any; headers?: any }[] = []
let googleQuotaZero = false
const http = (async (input: any, init: any = {}) => {
  const url = String(input); const method = init.method || 'GET'
  let body: any = init.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* form */ } }
  if (body instanceof URLSearchParams) body = Object.fromEntries(body)
  calls.push({ url, method, body, headers: init.headers })
  const j = (d: any, status = 200) => new Response(JSON.stringify(d), { status })
  const u = new URL(url)
  // Facebook
  if (u.host === 'graph.facebook.com') {
    if (u.pathname.endsWith('/oauth/access_token')) return u.searchParams.get('code') === 'bad' ? j({ error: { message: 'Invalid code' } }, 400) : j({ access_token: u.searchParams.get('grant_type') ? 'FB_LONG' : 'FB_SHORT', expires_in: 5184000 })
    if (u.pathname.endsWith('/me')) return j({ id: 'fbuser1', name: 'Maya Chen' })
    if (u.pathname.endsWith('/me/accounts')) return j({ data: [{ id: 'page1', name: 'Arch & Ink', access_token: 'PAGE_TOKEN_1' }] })
    if (u.pathname.endsWith('/me/adaccounts')) return j({ data: [{ id: 'act_9', name: 'Arch & Ink Ads', account_status: 1 }] })
    if (u.pathname.endsWith('/page1/subscribed_apps')) return j({ success: true })
    if (u.pathname.endsWith('/LG1') || u.pathname.endsWith('/LG2')) return u.searchParams.get('access_token') !== 'PAGE_TOKEN_1' ? j({ error: { message: 'bad token' } }, 400) : j({
      created_time: '2026-10-01T10:00:00+0000', form_id: 'F1', campaign_name: 'Fall Brows', is_organic: false,
      field_data: [{ name: 'full_name', values: ['Ana Morales'] }, { name: 'phone_number', values: ['+16615550123'] }, { name: 'email', values: ['ana@x.com'] }, { name: 'which_treatment?', values: ['Powder brows'] }],
    })
    if (u.pathname.endsWith('/F1')) return j({ name: 'Brows Lead Form' })
  }
  // Instagram
  if (u.host === 'api.instagram.com' && u.pathname === '/oauth/access_token') return j({ access_token: 'IG_SHORT', user_id: 1784, permissions: ['instagram_business_basic'] })
  if (u.host === 'graph.instagram.com') {
    if (u.pathname === '/access_token') return j({ access_token: 'IG_LONG', expires_in: 5184000 })
    if (u.pathname === '/refresh_access_token') return j({ access_token: 'IG_LONG_2', expires_in: 5184000 })
    if (u.pathname.endsWith('/me')) return j({ user_id: '1784', username: 'archandink', name: 'Arch & Ink', account_type: 'BUSINESS' })
    if (u.pathname.endsWith('/me/subscribed_apps')) return j({ success: true })
    if (u.pathname.endsWith('/me/messages')) return j({ recipient_id: body?.recipient?.id || 'x', message_id: 'mid.out.' + calls.length })
    if (u.pathname.endsWith('/555')) return j({ username: 'rosa.diaz', name: 'Rosa Diaz' })
  }
  // Google
  if (u.host === 'oauth2.googleapis.com') return j({ access_token: 'G_ACCESS_' + calls.length, refresh_token: body?.grant_type === 'refresh_token' ? undefined : 'G_REFRESH', expires_in: 3600 })
  if (googleQuotaZero && u.host.endsWith('googleapis.com')) return j({ error: { code: 429, message: 'Quota exceeded for quota metric', status: 'RESOURCE_EXHAUSTED' } }, 429)
  if (u.host === 'mybusinessaccountmanagement.googleapis.com') return j({ accounts: [{ name: 'accounts/111', accountName: 'Maya Chen' }] })
  if (u.host === 'mybusinessbusinessinformation.googleapis.com') {
    if (method === 'PATCH') return j({ name: 'locations/222', websiteUri: body.websiteUri })
    return j({ locations: [{ name: 'locations/222', title: 'Arch & Ink Brow Studio', websiteUri: 'https://old-site.com', storefrontAddress: { locality: 'Bakersfield' } }] })
  }
  if (u.host === 'mybusiness.googleapis.com') return j({ averageRating: 4.86, totalReviewCount: 212, reviews: [{ reviewer: { displayName: 'Kim' }, starRating: 'FIVE', comment: 'Best brows ever', createTime: '2026-09-20T00:00:00Z' }] })
  if (u.host === 'businessprofileperformance.googleapis.com') return j({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
    { dailyMetric: 'CALL_CLICKS', timeSeries: { datedValues: [{ value: '3' }, { value: '4' }] } },
    { dailyMetric: 'WEBSITE_CLICKS', timeSeries: { datedValues: [{ value: '10' }, {}] } },
    { dailyMetric: 'BUSINESS_DIRECTION_REQUESTS', timeSeries: { datedValues: [{ value: '2' }] } }] }] })
  return j({ error: { message: 'unexpected ' + method + ' ' + url } }, 404)
}) as typeof fetch

// ------------------------------------------------------------------ fixtures
const cfg: ConnectConfig = { functionsUrl: 'https://p.supabase.co/functions/v1', appUrl: 'https://app.test', metaAppId: 'MAPP', metaAppSecret: 'msecret', igAppId: 'IGAPP', igAppSecret: 'igsecret', metaVerifyToken: 'vt', googleClientId: 'GID', googleClientSecret: 'gsecret', graphVersion: 'v23.0' }
let sms: any[] = [], pushes: any[] = []
let clock = new Date('2026-10-01T15:00:00Z')
const deps = (over: Partial<ConnectConfig> = {}) => ({
  db: makeDb('https://x.supabase.co', 'svc', dbFetch),
  sms: async (to: string, from: string, body: string) => { sms.push({ to, from, body }); return { ok: true, sid: 'SM' } },
  push: async (_s: any[], p: any) => { pushes.push(p); return [] },
  email: async () => true,
  appUrl: 'https://app.test', now: () => clock, http, cfg: { ...cfg, ...over },
}) as any
function reset() {
  for (const k of Object.keys(T)) delete T[k]
  T.studios = [{ id: 's1', slug: 'arch-and-ink', config: { name: 'Arch & Ink', artist: { name: 'Maya' }, replyTime: '2 hours', rating: '4.9', reviewCount: '100', services: [{ key: 'powder', name: 'Powder Brows', price: 550 }], team: [] }, messaging: {} }]
  T.studio_members = [{ studio_id: 's1', user_id: 'u1' }]
  for (const t of ['leads', 'messages', 'followups', 'opt_outs', 'lead_events', 'connections', 'connection_secrets', 'oauth_states']) T[t] = []
  T.push_subscriptions = [{ studio_id: 's1', endpoint: 'e', p256dh: 'k', auth: 'a' }]
  sms = []; pushes = []; calls.length = 0
}
async function connect(p: 'meta' | 'instagram' | 'google', code = 'CODE') {
  const s: any = await startConnect(deps(), 'u1', 's1', p, '/app/more/connections')
  const state = new URL(s.url).searchParams.get('state')!
  return { start: s, back: await finishConnect(deps(), { code, state }) }
}

// ------------------------------------------------------------------ start
console.log('startConnect')
reset()
let r: any = await startConnect(deps(), 'stranger', 's1', 'meta', '/dashboard/connections')
ok(!r.ok && /access/.test(r.error), 'non-member refused')
r = await startConnect(deps({ metaAppId: '' }), 'u1', 's1', 'meta', '/x')
ok(!r.ok && /isn't set up/.test(r.error), 'unconfigured provider explained')
r = await startConnect(deps(), 'u1', 's1', 'meta', 'https://evil.com')
ok(r.ok && T.oauth_states[0].return_to === '/dashboard/connections', 'open redirect blocked')
const fbu = new URL(r.url)
ok(fbu.host === 'www.facebook.com' && fbu.searchParams.get('redirect_uri') === cfg.functionsUrl + '/connect-callback' && fbu.searchParams.get('scope')!.includes('leads_retrieval'), 'facebook login url')
r = await startConnect(deps(), 'u1', 's1', 'instagram', '/app/more/connections')
ok(new URL(r.url).host === 'www.instagram.com' && new URL(r.url).searchParams.get('scope')!.includes('instagram_business_manage_messages'), 'instagram login url')
r = await startConnect(deps(), 'u1', 's1', 'google', '/app')
ok(new URL(r.url).searchParams.get('access_type') === 'offline' && new URL(r.url).searchParams.get('prompt') === 'consent', 'google offline consent')

// ------------------------------------------------------------------ callbacks
console.log('finishConnect')
reset()
let c = await connect('meta')
ok(c.back === 'https://app.test/app/more/connections?connected=meta', 'meta: back to app with connected: ' + c.back)
let conn = T.connections.find((x) => x.provider === 'meta')
ok(conn?.status === 'connected' && conn.account_name === 'Maya Chen' && conn.external_ids[0] === 'page1', 'meta connection saved')
ok(conn.details.pages[0].leadForms && conn.details.adAccounts[0].name === 'Arch & Ink Ads', 'page subscribed + ad account listed')
ok(T.connection_secrets[0].page_tokens.page1 === 'PAGE_TOKEN_1' && T.connection_secrets[0].access_token === 'FB_LONG', 'tokens stored server-side (long-lived)')
ok(calls.some((x) => x.url.includes('/page1/subscribed_apps') && x.method === 'POST' && x.url.includes('subscribed_fields=leadgen')), 'leadgen webhook subscribed')
ok(T.oauth_states.length === 0, 'state used once')
const reused = await finishConnect(deps(), { code: 'CODE', state: new URL((await startConnect(deps(), 'u1', 's1', 'meta', '/app')).url).searchParams.get('state')! })
ok(reused.includes('connected=meta'), 'reconnect works')
ok(T.connections.filter((x) => x.provider === 'meta').length === 1, 'reconnect replaces, no duplicates')
c = await connect('meta', 'bad')
ok(c.back.includes('connect_error=meta') && decodeURIComponent(c.back.replace(/\+/g, ' ')).includes('Invalid code'), 'bad code → error back to app: ' + c.back)
let s0: any = await startConnect(deps(), 'u1', 's1', 'instagram', '/app')
let back = await finishConnect(deps(), { error: 'access_denied', state: new URL(s0.url).searchParams.get('state')! })
ok(decodeURIComponent(back.replace(/\+/g, ' ')).includes('You cancelled the login.'), 'cancel explained')
back = await finishConnect(deps(), { code: 'x', state: 'forged' })
ok(back.includes('connect_error=unknown'), 'forged state refused')
s0 = await startConnect(deps(), 'u1', 's1', 'instagram', '/app')
clock = new Date(clock.getTime() + 30 * 60e3)
back = await finishConnect(deps(), { code: 'x', state: new URL(s0.url).searchParams.get('state')! })
ok(back.includes('connect_error=instagram'), 'expired state refused')
clock = new Date('2026-10-01T15:00:00Z')

c = await connect('instagram')
conn = T.connections.find((x) => x.provider === 'instagram')
ok(c.back.includes('connected=instagram') && conn.account_name === '@archandink' && conn.external_ids[0] === '1784', 'instagram connected')
ok(T.connection_secrets.find((x) => x.provider === 'instagram').access_token === 'IG_LONG', 'instagram long-lived token')
ok(calls.some((x) => x.url.includes('/me/subscribed_apps') && x.url.includes('messages%2Ccomments')), 'instagram webhooks subscribed')

c = await connect('google')
conn = T.connections.find((x) => x.provider === 'google')
ok(conn.status === 'connected' && conn.account_name === 'Arch & Ink Brow Studio' && conn.details.location === 'locations/222', 'google connected with location')
ok(T.connection_secrets.find((x) => x.provider === 'google').refresh_token === 'G_REFRESH', 'google refresh token kept')

// ------------------------------------------------------------------ Meta lead form webhook
console.log('lead forms')
const wh = (leadgen_id: string, page_id = 'page1') => ({ object: 'page', entry: [{ id: page_id, changes: [{ field: 'leadgen', value: { leadgen_id, page_id, form_id: 'F1' } }] }] })
r = await handleMetaWebhook(deps(), wh('LG1'))
let lead = T.leads.find((l) => l.quiz.leadgenId === 'LG1')
ok(lead && lead.name === 'Ana Morales' && lead.phone === '+16615550123' && lead.email === 'ana@x.com' && lead.source === 'meta-form', 'lead form → lead')
ok(lead.campaign === 'Fall Brows' && lead.message === 'which treatment: Powder brows' && lead.quiz.formName === 'Brows Lead Form', 'campaign, custom answers, form name')
ok(T.connections.find((x) => x.provider === 'meta').last_event_at, 'last lead time recorded')
await handleMetaWebhook(deps(), wh('LG1'))
ok(T.leads.filter((l) => l.quiz.leadgenId === 'LG1').length === 1, 'Meta retries do not duplicate')
r = await handleMetaWebhook(deps(), wh('LG2', 'otherpage'))
ok(r.handled[0].skipped?.startsWith('no studio'), 'unknown page ignored')

// ------------------------------------------------------------------ Instagram DMs
console.log('instagram DMs')
const dm = (text: string, mid: string, extra: any = {}) => ({ object: 'instagram', entry: [{ id: '1784', time: 1, messaging: [{ sender: { id: '555' }, recipient: { id: '1784' }, timestamp: 1, message: { mid, text, ...extra } }] }] })
pushes = []; calls.length = 0
r = await handleMetaWebhook(deps(), dm('Hi! Are you open Saturday?', 'mid.1'))
lead = T.leads.find((l) => l.ig_user_id === '555')
ok(lead && lead.name === 'Rosa Diaz' && lead.ig_username === 'rosa.diaz' && lead.phone === null && lead.source === 'ig-dm' && lead.quiz.origin === 'instagram', 'DM creates an Instagram lead (no phone)')
ok(T.messages.some((m) => m.lead_id === lead.id && m.direction === 'in' && m.channel === 'instagram'), 'DM stored in the thread')
const welcome = calls.find((x) => x.url.endsWith('/me/messages'))
ok(welcome && welcome.body.recipient.id === '555' && welcome.body.message.text.includes('thanks for messaging Arch & Ink') && welcome.body.message.text.includes('src=ig-dm'), 'instant DM reply with tracked link')
ok(pushes[0]?.title === 'New Instagram DM: Rosa Diaz', 'owner alerted: ' + pushes[0]?.title)
ok(lead.has_unread, 'unread')
calls.length = 0; pushes = []
await handleMetaWebhook(deps(), dm('ok thanks', 'mid.2'))
ok(!calls.some((x) => x.url.endsWith('/me/messages')) && T.leads.filter((l) => l.ig_user_id === '555').length === 1, 'second DM: same lead, no auto reply')
ok(pushes[0]?.title === 'Rosa Diaz messaged on Instagram', 'reply alert')
await handleMetaWebhook(deps(), dm('ok thanks', 'mid.2'))
ok(T.messages.filter((m) => m.provider_id === 'mid.2').length === 1, 'duplicate DM ignored')
calls.length = 0
await handleMetaWebhook(deps(), dm('what about LIPS price', 'mid.3'))
ok(calls.some((x) => x.url.endsWith('/me/messages') && x.body.message.text.includes('find your perfect match')), 'keyword in DM gets the link')
// echo from the Instagram app
await handleMetaWebhook(deps(), { object: 'instagram', entry: [{ id: '1784', messaging: [{ sender: { id: '1784' }, recipient: { id: '555' }, message: { mid: 'mid.echo', text: 'Sent from my phone', is_echo: true } }] }] })
ok(T.messages.some((m) => m.provider_id === 'mid.echo' && m.sent_by === 'instagram-app' && m.direction === 'out'), 'replies from the Instagram app appear in the thread')

// owner replies from our inbox through Instagram
calls.length = 0
r = await ownerSend(deps(), 'u1', lead.id, 'Powder brows are $550!')
ok(r.ok && calls.some((x) => x.url.endsWith('/me/messages') && x.body.recipient.id === '555' && x.headers.Authorization === 'Bearer IG_LONG'), 'owner reply goes by Instagram DM')
ok(T.messages.some((m) => m.body === 'Powder brows are $550!' && m.channel === 'instagram' && m.sent_by === 'u1'), 'logged as instagram')
ok(!sms.some((x) => x.body.includes('Powder brows are')), 'not sent by SMS')
clock = new Date(clock.getTime() + 25 * 3600e3)
r = await ownerSend(deps(), 'u1', lead.id, 'still there?')
ok(!r.ok && /24 hours/.test(r.error), '24-hour window enforced')
clock = new Date('2026-10-01T15:00:00Z')

// ------------------------------------------------------------------ comments
console.log('instagram comments')
const cm = (text: string, from = { id: '777', username: 'kayla.t' }) => ({ object: 'instagram', entry: [{ id: '1784', changes: [{ field: 'comments', value: { id: 'C1', text, from, media: { id: 'M1' } } }] }] })
calls.length = 0; pushes = []
r = await handleMetaWebhook(deps(), cm('love this!!'))
ok(r.handled[0].skipped === 'no keyword' && !T.leads.some((l) => l.ig_user_id === '777'), 'ordinary comment ignored')
r = await handleMetaWebhook(deps(), cm('Brows please 😍'))
lead = T.leads.find((l) => l.ig_user_id === '777')
const pr = calls.find((x) => x.url.endsWith('/me/messages'))
ok(lead && lead.source === 'ig-comment' && lead.name === '@kayla.t', 'keyword comment → lead')
ok(pr && pr.body.recipient.comment_id === 'C1' && pr.body.message.text.includes('src=ig-comment'), 'private reply to the comment with link')
ok(pushes[0]?.title === '@kayla.t commented "BROWS"', 'owner alert: ' + pushes[0]?.title)
T.studios[0].messaging = { igKeywords: [{ word: 'GLOW', reply: 'Glow link: {link}' }] }
calls.length = 0
await handleMetaWebhook(deps(), cm('BROWS'))
ok(!calls.some((x) => x.url.endsWith('/me/messages')), 'custom keyword list replaces defaults')
await handleMetaWebhook(deps(), cm('glow', { id: '888', username: 'z' }))
ok(calls.some((x) => x.body?.message?.text?.startsWith('Glow link: https://app.test/s/arch-and-ink?src=ig-comment')), 'custom keyword reply')
await handleMetaWebhook(deps(), cm('GLOW', { id: '1784', username: 'archandink' }))
ok(T.leads.filter((l) => l.ig_user_id === '1784').length === 0, 'own comments ignored')

// ------------------------------------------------------------------ Google tools
console.log('google')
r = await googleAction(deps(), 'stranger', 's1', 'refresh')
ok(!r.ok, 'non-member blocked')
clock = new Date(clock.getTime() + 2 * 3600e3) // access token expired → refresh
calls.length = 0
r = await googleAction(deps(), 'u1', 's1', 'set-website')
ok(r.ok && r.websiteUri === 'https://app.test/s/arch-and-ink?src=google', 'website button set')
ok(calls[0].url.startsWith('https://oauth2.googleapis.com/token') && calls[0].body.grant_type === 'refresh_token', 'expired token refreshed first')
const patch = calls.find((x) => x.method === 'PATCH')
ok(patch.url.includes('locations/222?updateMask=websiteUri'), 'PATCH websiteUri')
r = await googleAction(deps(), 'u1', 's1', 'refresh')
conn = T.connections.find((x) => x.provider === 'google')
ok(r.ok && conn.details.reviews.average === 4.9 && conn.details.reviews.total === 212 && conn.details.reviews.latest[0].stars === 5, 'reviews pulled')
ok(conn.details.insights.calls === 7 && conn.details.insights.websiteClicks === 10 && conn.details.insights.directions === 2, 'profile stats summed')
ok(T.studios[0].config.rating === '4.9' && T.studios[0].config.reviewCount === '212', 'studio page rating updated')
ok(calls.some((x) => x.url.includes('mybusiness.googleapis.com/v4/accounts/111/locations/222/reviews')), 'reviews path')
// Before Google approves the API: connect still succeeds, with a clear note
reset(); googleQuotaZero = true
c = await connect('google')
conn = T.connections.find((x) => x.provider === 'google')
ok(c.back.includes('connected=google') && conn.status === 'needs_attention' && /still approving/.test(conn.error), 'quota 0 explained: ' + conn?.error)
googleQuotaZero = false

// ------------------------------------------------------------------ tokens, signatures, deauthorize
console.log('tokens + security')
reset(); await connect('instagram'); await connect('meta')
T.connection_secrets.find((x) => x.provider === 'instagram').expires_at = new Date(clock.getTime() + 5 * 864e5).toISOString()
r = await refreshTokens(deps())
ok(r.refreshed === 1 && T.connection_secrets.find((x) => x.provider === 'instagram').access_token === 'IG_LONG_2', 'instagram token refreshed')
const raw = JSON.stringify({ object: 'page', entry: [] })
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('igsecret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const hex = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('')
ok(await validMetaSignature(raw, 'sha256=' + hex, ['msecret', 'igsecret']), 'webhook signature (Instagram secret) accepted')
ok(!(await validMetaSignature(raw + ' ', 'sha256=' + hex, ['msecret', 'igsecret'])), 'tampered body rejected')
ok(!(await validMetaSignature(raw, null, ['msecret'])), 'missing signature rejected')
const payload = btoa(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: 'fbuser1' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const k2 = await crypto.subtle.importKey('raw', new TextEncoder().encode('msecret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k2, new TextEncoder().encode(payload))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const parsed = await parseSignedRequest(sig + '.' + payload, ['msecret'])
ok(parsed?.user_id === 'fbuser1', 'signed_request parsed')
ok(!(await parseSignedRequest('x' + sig + '.' + payload, ['msecret'])), 'bad signed_request rejected')
const n = await handleDeauthorize(deps(), 'fbuser1')
ok(n === 1 && T.connections.find((x) => x.provider === 'meta').status === 'disconnected' && !T.connection_secrets.some((x) => x.provider === 'meta'), 'deauthorize wipes tokens')
ok(T.connections.find((x) => x.provider === 'instagram').status === 'connected', 'other connections untouched')

console.log(`\n${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
