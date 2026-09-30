// One-tap account connections: Instagram (DMs + comment keywords), Meta (lead forms + ad accounts),
// Google Business Profile (website button, reviews, profile stats).
//
// Flow: the app calls connect-start → owner logs in at Instagram / Facebook / Google → the provider
// sends them back to connect-callback → we store the tokens (server-only table) and subscribe to
// webhooks → meta-webhook receives lead forms, DMs and comments from then on.
//
// All outside HTTP goes through d.http so the tests can fake Meta and Google.
import { eq } from './db.ts'
import { alertOwner, loadStudio, logEvent, settings, varsFor, type Deps } from './core.ts'
import { DEFAULT_IG_KEYWORDS, DEFAULT_IG_KEYWORD_REPLY, DEFAULT_IG_WELCOME, fill } from './templates.ts'
export { DEFAULT_IG_KEYWORDS, DEFAULT_IG_KEYWORD_REPLY, DEFAULT_IG_WELCOME }

export type Provider = 'instagram' | 'meta' | 'google'
export const PROVIDERS: Provider[] = ['instagram', 'meta', 'google']

export interface ConnectConfig {
  functionsUrl: string
  appUrl: string
  metaAppId: string
  metaAppSecret: string
  igAppId: string
  igAppSecret: string
  metaVerifyToken: string
  googleClientId: string
  googleClientSecret: string
  graphVersion: string // e.g. v23.0
}

export const SCOPES = {
  meta: ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_manage_ads', 'leads_retrieval', 'ads_read', 'business_management'],
  instagram: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'],
  google: ['https://www.googleapis.com/auth/business.manage'],
}


const need = (c: ConnectConfig, p: Provider) =>
  p === 'google' ? Boolean(c.googleClientId && c.googleClientSecret)
  : p === 'instagram' ? Boolean(c.igAppId && c.igAppSecret)
  : Boolean(c.metaAppId && c.metaAppSecret)

export const configured = (c: ConnectConfig) => ({ instagram: need(c, 'instagram'), meta: need(c, 'meta'), google: need(c, 'google') })

const cb = (c: ConnectConfig) => `${c.functionsUrl}/connect-callback`
const fb = (c: ConnectConfig) => `https://graph.facebook.com/${c.graphVersion}`
const ig = (c: ConnectConfig) => `https://graph.instagram.com/${c.graphVersion}`

async function getJson(d: Deps, url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await d.http!(url, init)
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}
const errText = (x: { status: number; data: any }) => x.data?.error?.message || x.data?.error_description || x.data?.error?.status || `HTTP ${x.status}`

function randomState() {
  const b = new Uint8Array(24); crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- 1. start: build the login URL
export async function startConnect(d: Deps, userId: string, studioId: string, provider: Provider, returnTo: string) {
  const c = d.cfg!
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'Unknown account type' }
  if (!need(c, provider)) return { ok: false, error: `${label(provider)} isn't set up on the server yet (app id and secret missing).` }
  const member = await d.db.one('studio_members', `studio_id=${eq(studioId)}&user_id=${eq(userId)}`)
  if (!member) return { ok: false, error: 'You don\'t have access to this studio' }
  const safeReturn = /^\/(app|dashboard)(\/[\w/-]*)?$/.test(returnTo) ? returnTo : '/dashboard/connections'
  const state = randomState()
  await d.db.insert('oauth_states', [{ state, studio_id: studioId, user_id: userId, provider, return_to: safeReturn }])
  let url: string
  if (provider === 'meta') {
    url = `https://www.facebook.com/${c.graphVersion}/dialog/oauth?` + new URLSearchParams({ client_id: c.metaAppId, redirect_uri: cb(c), state, response_type: 'code', scope: SCOPES.meta.join(',') })
  } else if (provider === 'instagram') {
    url = 'https://www.instagram.com/oauth/authorize?' + new URLSearchParams({ client_id: c.igAppId, redirect_uri: cb(c), state, response_type: 'code', scope: SCOPES.instagram.join(','), enable_fb_login: '0', force_authentication: '1' })
  } else {
    url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.googleClientId, redirect_uri: cb(c), state, response_type: 'code', scope: SCOPES.google.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' })
  }
  return { ok: true, url }
}

export const label = (p: Provider) => (p === 'meta' ? 'Meta ads' : p === 'instagram' ? 'Instagram' : 'Google Business Profile')

// ---------------------------------------------------------------- 2. callback: swap the code for tokens
/** Returns the URL to send the owner back to (with ?connected= or ?connect_error=). */
export async function finishConnect(d: Deps, q: { code?: string; state?: string; error?: string; error_description?: string }): Promise<string> {
  const c = d.cfg!
  const back = (path: string, params: Record<string, string>) => `${c.appUrl}${path}?${new URLSearchParams(params)}`
  if (!q.state) return back('/dashboard/connections', { connect_error: 'unknown', reason: 'The login link expired. Try again.' })
  const st = await d.db.one('oauth_states', `state=${eq(q.state)}`)
  if (!st) return back('/dashboard/connections', { connect_error: 'unknown', reason: 'The login link expired. Try again.' })
  await d.db.remove('oauth_states', `state=${eq(q.state)}`)
  const provider = st.provider as Provider
  const fail = (reason: string) => back(st.return_to, { connect_error: provider, reason })
  const age = (d.now?.() || new Date()).getTime() - new Date(st.created_at).getTime()
  if (age > 20 * 60e3) return fail('The login took too long. Try again.')
  if (q.error || !q.code) return fail(q.error === 'access_denied' || /denied|cancel/i.test(q.error_description || q.error || '') ? 'You cancelled the login.' : (q.error_description || 'The login didn\'t finish.'))
  try {
    const r = provider === 'meta' ? await finishMeta(d, st, q.code) : provider === 'instagram' ? await finishInstagram(d, st, q.code) : await finishGoogle(d, st, q.code)
    if (!r.ok) return fail(r.error!)
    return back(st.return_to, { connected: provider })
  } catch (e) {
    return fail('Something went wrong: ' + String((e as Error)?.message || e).slice(0, 140))
  }
}

async function saveConnection(d: Deps, st: any, provider: Provider, row: Record<string, unknown>, secret: Record<string, unknown>) {
  const now = (d.now?.() || new Date()).toISOString()
  await d.db.remove('connections', `studio_id=${eq(st.studio_id)}&provider=eq.${provider}`)
  await d.db.insert('connections', [{ studio_id: st.studio_id, provider, status: 'connected', error: null, connected_by: st.user_id, connected_at: now, updated_at: now, ...row }])
  await d.db.remove('connection_secrets', `studio_id=${eq(st.studio_id)}&provider=eq.${provider}`)
  await d.db.insert('connection_secrets', [{ studio_id: st.studio_id, provider, updated_at: now, ...secret }])
}

async function finishMeta(d: Deps, st: any, code: string) {
  const c = d.cfg!
  const t1 = await getJson(d, `${fb(c)}/oauth/access_token?` + new URLSearchParams({ client_id: c.metaAppId, client_secret: c.metaAppSecret, redirect_uri: cb(c), code }))
  if (!t1.ok) return { ok: false, error: 'Facebook login failed: ' + errText(t1) }
  // Long-lived user token (about 60 days). Page tokens made from it don't expire.
  const t2 = await getJson(d, `${fb(c)}/oauth/access_token?` + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: c.metaAppId, client_secret: c.metaAppSecret, fb_exchange_token: t1.data.access_token }))
  const userToken = t2.ok ? t2.data.access_token : t1.data.access_token
  const me = await getJson(d, `${fb(c)}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`)
  const pages = await getJson(d, `${fb(c)}/me/accounts?fields=id,name,access_token&limit=50&access_token=${encodeURIComponent(userToken)}`)
  if (!pages.ok) return { ok: false, error: 'Couldn\'t read your Facebook Pages: ' + errText(pages) }
  const list: any[] = pages.data.data || []
  if (!list.length) return { ok: false, error: 'No Facebook Page was shared. Lead forms belong to a Page, so tick your studio\'s Page when Facebook asks.' }
  const ads = await getJson(d, `${fb(c)}/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${encodeURIComponent(userToken)}`)
  // Subscribe every shared Page to lead-form webhooks.
  const pageInfo = []
  const pageTokens: Record<string, string> = {}
  for (const p of list) {
    pageTokens[p.id] = p.access_token
    const sub = await getJson(d, `${fb(c)}/${p.id}/subscribed_apps?` + new URLSearchParams({ subscribed_fields: 'leadgen', access_token: p.access_token }), { method: 'POST' })
    pageInfo.push({ id: p.id, name: p.name, leadForms: sub.ok && sub.data?.success !== false, error: sub.ok ? undefined : errText(sub) })
  }
  const adAccounts = (ads.ok ? ads.data.data || [] : []).map((a: any) => ({ id: a.id, name: a.name, active: a.account_status === 1 }))
  const anyLive = pageInfo.some((p) => p.leadForms)
  await saveConnection(d, st, 'meta', {
    account_name: me.data?.name || 'Facebook account',
    external_ids: list.map((p) => String(p.id)),
    details: { userId: me.data?.id, pages: pageInfo, adAccounts },
    status: anyLive ? 'connected' : 'needs_attention',
    error: anyLive ? null : 'Connected, but lead forms couldn\'t be switched on for your Page. You may need to be a Page admin.',
  }, { access_token: userToken, page_tokens: pageTokens, expires_at: t2.ok && t2.data.expires_in ? new Date(Date.now() + t2.data.expires_in * 1000).toISOString() : null })
  return { ok: true }
}

async function finishInstagram(d: Deps, st: any, code: string) {
  const c = d.cfg!
  const form = new URLSearchParams({ client_id: c.igAppId, client_secret: c.igAppSecret, grant_type: 'authorization_code', redirect_uri: cb(c), code })
  const t1 = await getJson(d, 'https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  const short = t1.data?.access_token || t1.data?.data?.[0]?.access_token
  if (!t1.ok || !short) return { ok: false, error: 'Instagram login failed: ' + errText(t1) }
  // Long-lived token (60 days, refreshed daily by refresh-tokens).
  const t2 = await getJson(d, 'https://graph.instagram.com/access_token?' + new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: c.igAppSecret, access_token: short }))
  const token = t2.ok ? t2.data.access_token : short
  const me = await getJson(d, `${ig(c)}/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${encodeURIComponent(token)}`)
  if (!me.ok) return { ok: false, error: 'Couldn\'t read your Instagram profile: ' + errText(me) }
  const sub = await getJson(d, `${ig(c)}/me/subscribed_apps?` + new URLSearchParams({ subscribed_fields: 'messages,comments', access_token: token }), { method: 'POST' })
  const igId = String(me.data.user_id || me.data.id)
  await saveConnection(d, st, 'instagram', {
    account_name: '@' + me.data.username,
    external_ids: [igId],
    details: { igUserId: igId, username: me.data.username, name: me.data.name, picture: me.data.profile_picture_url, accountType: me.data.account_type },
    status: sub.ok ? 'connected' : 'needs_attention',
    error: sub.ok ? null : 'Connected, but DMs couldn\'t be switched on: ' + errText(sub),
  }, { access_token: token, expires_at: t2.ok && t2.data.expires_in ? new Date(Date.now() + t2.data.expires_in * 1000).toISOString() : null })
  return { ok: true }
}

async function finishGoogle(d: Deps, st: any, code: string) {
  const c = d.cfg!
  const tok = await getJson(d, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.googleClientId, client_secret: c.googleClientSecret, redirect_uri: cb(c), grant_type: 'authorization_code' }),
  })
  if (!tok.ok) return { ok: false, error: 'Google login failed: ' + errText(tok) }
  const auth = { Authorization: `Bearer ${tok.data.access_token}` }
  const secret = { access_token: tok.data.access_token, refresh_token: tok.data.refresh_token || null, expires_at: new Date(Date.now() + (tok.data.expires_in || 3600) * 1000).toISOString() }
  const accts = await getJson(d, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: auth })
  if (!accts.ok) {
    // Most common before Google approves API access: quota is 0, so every call is refused.
    await saveConnection(d, st, 'google', { account_name: 'Google account', details: {}, status: 'needs_attention', error: googleHint(accts) }, secret)
    return { ok: true }
  }
  const account = (accts.data.accounts || [])[0]
  let locations: any[] = []
  if (account) {
    const locs = await getJson(d, `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,websiteUri,storefrontAddress&pageSize=20`, { headers: auth })
    locations = (locs.data.locations || []).map((l: any) => ({ name: l.name, title: l.title, websiteUri: l.websiteUri || null, city: l.storefrontAddress?.locality || null }))
  }
  await saveConnection(d, st, 'google', {
    account_name: locations[0]?.title || account?.accountName || 'Google Business Profile',
    details: { account: account?.name || null, locations, location: locations[0]?.name || null },
    status: locations.length ? 'connected' : 'needs_attention',
    error: locations.length ? null : 'No business profile found on this Google account. Log in with the account that manages your Google profile.',
  }, secret)
  return { ok: true }
}

function googleHint(x: { status: number; data: any }) {
  const m = errText(x)
  return x.status === 429 || /quota|has not been used|not been enabled|PERMISSION_DENIED/i.test(m)
    ? 'Connected. Google is still approving our access to Business Profile data, so the profile tools switch on once that\'s done.'
    : 'Google said: ' + m
}

// ---------------------------------------------------------------- tokens
async function secretFor(d: Deps, studioId: string, provider: Provider) {
  return d.db.one('connection_secrets', `studio_id=${eq(studioId)}&provider=eq.${provider}`)
}

async function googleToken(d: Deps, studioId: string): Promise<string | null> {
  const s = await secretFor(d, studioId, 'google')
  if (!s) return null
  const now = (d.now?.() || new Date()).getTime()
  if (s.access_token && s.expires_at && new Date(s.expires_at).getTime() - now > 120e3) return s.access_token
  if (!s.refresh_token) return s.access_token
  const c = d.cfg!
  const r = await getJson(d, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.googleClientId, client_secret: c.googleClientSecret, refresh_token: s.refresh_token, grant_type: 'refresh_token' }),
  })
  if (!r.ok) {
    await d.db.update('connections', `studio_id=${eq(studioId)}&provider=eq.google`, { status: 'needs_attention', error: 'Google access expired. Connect again.' })
    return null
  }
  await d.db.update('connection_secrets', `studio_id=${eq(studioId)}&provider=eq.google`, { access_token: r.data.access_token, expires_at: new Date(now + (r.data.expires_in || 3600) * 1000).toISOString() })
  return r.data.access_token
}

/** Daily: keep Instagram tokens alive (they last 60 days unless refreshed). */
export async function refreshTokens(d: Deps) {
  const soon = new Date((d.now?.() || new Date()).getTime() + 20 * 864e5).toISOString()
  const rows = await d.db.select('connection_secrets', `provider=eq.instagram&expires_at=lte.${encodeURIComponent(soon)}&select=studio_id,access_token`)
  let refreshed = 0
  for (const s of rows) {
    const r = await getJson(d, 'https://graph.instagram.com/refresh_access_token?' + new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: s.access_token }))
    if (r.ok && r.data.access_token) {
      await d.db.update('connection_secrets', `studio_id=${eq(s.studio_id)}&provider=eq.instagram`, { access_token: r.data.access_token, expires_at: new Date(Date.now() + (r.data.expires_in || 5184000) * 1000).toISOString() })
      refreshed++
    } else {
      await d.db.update('connections', `studio_id=${eq(s.studio_id)}&provider=eq.instagram`, { status: 'needs_attention', error: 'Instagram access is about to expire. Connect again to keep DMs coming in.' })
    }
  }
  return { ok: true, checked: rows.length, refreshed }
}

// ---------------------------------------------------------------- Instagram send
/** Sends a DM from the studio's Instagram. recipient is { id } (a person) or { comment_id } (private reply to a comment). */
export async function igSend(d: Deps, studioId: string, recipient: { id?: string; comment_id?: string }, text: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const s = await secretFor(d, studioId, 'instagram')
  if (!s?.access_token) return { ok: false, error: 'Instagram isn\'t connected' }
  const r = await getJson(d, `${ig(d.cfg!)}/me/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
    body: JSON.stringify({ recipient, message: { text: text.slice(0, 1000) } }),
  })
  return r.ok ? { ok: true, sid: r.data.message_id } : { ok: false, error: 'Instagram: ' + errText(r) }
}

// ---------------------------------------------------------------- 3. webhooks from Meta
export async function validMetaSignature(raw: string, header: string | null, secrets: string[]) {
  if (!header?.startsWith('sha256=')) return false
  for (const secret of secrets.filter(Boolean)) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
    const hex = Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
    if (hex === header.slice(7)) return true
  }
  return false
}

async function connectionFor(d: Deps, provider: Provider, externalId: string) {
  return d.db.one('connections', `provider=eq.${provider}&status=neq.disconnected&external_ids=cs.${encodeURIComponent('{' + externalId + '}')}`)
}

export async function handleMetaWebhook(d: Deps, body: any) {
  const out: any[] = []
  for (const entry of body?.entry || []) {
    if (body.object === 'page') {
      for (const ch of entry.changes || []) if (ch.field === 'leadgen') out.push(await onLeadgen(d, ch.value))
    } else if (body.object === 'instagram') {
      for (const m of entry.messaging || []) out.push(await onIgMessage(d, String(entry.id), m))
      for (const ch of entry.changes || []) if (ch.field === 'comments') out.push(await onIgComment(d, String(entry.id), ch.value))
    }
  }
  return { ok: true, handled: out }
}

async function onLeadgen(d: Deps, v: any) {
  const conn = await connectionFor(d, 'meta', String(v.page_id))
  if (!conn) return { skipped: 'no studio for page ' + v.page_id }
  const dup = await d.db.one('leads', `studio_id=${eq(conn.studio_id)}&quiz->>leadgenId=${eq(String(v.leadgen_id))}&select=id`)
  if (dup) return { skipped: 'duplicate', leadId: dup.id }
  const sec = await secretFor(d, conn.studio_id, 'meta')
  const token = sec?.page_tokens?.[v.page_id]
  if (!token) return { skipped: 'no page token' }
  const c = d.cfg!
  const l = await getJson(d, `${fb(c)}/${v.leadgen_id}?fields=created_time,field_data,ad_name,campaign_name,form_id,is_organic&access_token=${encodeURIComponent(token)}`)
  if (!l.ok) {
    await d.db.update('connections', `studio_id=${eq(conn.studio_id)}&provider=eq.meta`, { status: 'needs_attention', error: 'A lead form came in but Meta refused to share it: ' + errText(l) })
    return { error: errText(l) }
  }
  let formName = ''
  if (v.form_id || l.data.form_id) {
    const f = await getJson(d, `${fb(c)}/${v.form_id || l.data.form_id}?fields=name&access_token=${encodeURIComponent(token)}`)
    formName = f.ok ? f.data.name || '' : ''
  }
  const fields: Record<string, string> = {}
  for (const f of l.data.field_data || []) fields[String(f.name).toLowerCase()] = (f.values || []).join(', ')
  const pick = (...keys: string[]) => keys.map((k) => fields[k]).find(Boolean) || ''
  const name = pick('full_name', 'name') || [pick('first_name'), pick('last_name')].filter(Boolean).join(' ') || 'Meta lead'
  const phone = pick('phone_number', 'phone', 'mobile')
  const email = pick('email')
  const known = new Set(['full_name', 'name', 'first_name', 'last_name', 'phone_number', 'phone', 'mobile', 'email'])
  const extra = Object.entries(fields).filter(([k]) => !known.has(k)).map(([k, val]) => `${k.replace(/_/g, ' ').replace(/\?$/, '')}: ${val}`).join('\n')
  const studio = await loadStudio(d.db, conn.studio_id)
  const id = await d.db.rpc('submit_lead', {
    p_slug: studio.slug,
    p_lead: {
      kind: 'lead', name: name.slice(0, 80), phone: phone || 'Not given', email: email || undefined, source: 'meta-form',
      campaign: (l.data.campaign_name || l.data.ad_name || formName || 'Lead form').slice(0, 120),
      message: extra ? extra.slice(0, 2000) : undefined,
      quiz: { leadgenId: String(v.leadgen_id), formName: formName || undefined, organic: l.data.is_organic || undefined },
      assignedTo: 'desk',
    },
  })
  await d.db.update('connections', `studio_id=${eq(conn.studio_id)}&provider=eq.meta`, { last_event_at: (d.now?.() || new Date()).toISOString() })
  return { leadId: id }
}

/** Finds the lead for an Instagram user, or creates one (no phone yet). */
async function igLead(d: Deps, studio: any, igUserId: string, source: 'ig-dm' | 'ig-comment', text: string, username?: string) {
  let lead = await d.db.one('leads', `studio_id=${eq(studio.id)}&ig_user_id=${eq(igUserId)}&order=created_at.desc`)
  if (lead) return { lead, isNew: false }
  let uname = username, name = ''
  if (!uname) {
    const sec = await secretFor(d, studio.id, 'instagram')
    const p = sec ? await getJson(d, `${ig(d.cfg!)}/${igUserId}?fields=name,username&access_token=${encodeURIComponent(sec.access_token)}`) : null
    if (p?.ok) { uname = p.data.username; name = p.data.name || '' }
  }
  const [row] = await d.db.insert('leads', [{
    studio_id: studio.id, kind: 'chat', status: 'new', name: (name || (uname ? '@' + uname : 'Instagram user')).slice(0, 80), phone: null,
    source, message: text.slice(0, 2000), quiz: { origin: 'instagram' }, assigned_to: 'desk', ig_user_id: igUserId, ig_username: uname || null,
  }])
  await logEvent(d.db, row, 'source', source === 'ig-dm' ? 'Came from Instagram DM' : 'Came from Instagram comment')
  return { lead: row, isNew: true }
}

async function onIgMessage(d: Deps, igAccountId: string, m: any) {
  const conn = await connectionFor(d, 'instagram', igAccountId)
  if (!conn) return { skipped: 'no studio for ig ' + igAccountId }
  const msg = m.message
  if (!msg || msg.is_deleted || m.read || m.reaction) return { skipped: 'not a message' }
  const studio = await loadStudio(d.db, conn.studio_id)
  const now = (d.now?.() || new Date()).toISOString()
  const text = msg.text || (msg.attachments?.length ? '[Sent a ' + (msg.attachments[0].type || 'file') + ']' : '')
  // Echo = a message the studio sent (from our inbox, or from the Instagram app itself).
  if (msg.is_echo) {
    const mine = msg.mid && (await d.db.one('messages', `provider_id=${eq(msg.mid)}&select=id`))
    if (mine) return { skipped: 'our own send' }
    const lead = await d.db.one('leads', `studio_id=${eq(studio.id)}&ig_user_id=${eq(String(m.recipient?.id))}&order=created_at.desc`)
    if (!lead) return { skipped: 'echo for unknown user' }
    await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', channel: 'instagram', body: text.slice(0, 1600), status: 'sent', sent_by: 'instagram-app', provider_id: msg.mid || null }])
    return { echo: lead.id }
  }
  const senderId = String(m.sender?.id)
  if (msg.mid && (await d.db.one('messages', `provider_id=${eq(msg.mid)}&select=id`))) return { skipped: 'duplicate' }
  const { lead, isNew } = await igLead(d, studio, senderId, 'ig-dm', text)
  await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'in', channel: 'instagram', body: (text || '[message]').slice(0, 1600), status: 'received', provider_id: msg.mid || null }])
  await d.db.update('leads', `id=${eq(lead.id)}`, { has_unread: true, last_message_at: now })
  await d.db.update('followups', `lead_id=${eq(lead.id)}&status=eq.active`, { status: 'stopped', stop_reason: 'They replied' })
  await d.db.update('connections', `studio_id=${eq(studio.id)}&provider=eq.instagram`, { last_event_at: now })

  const m2 = settings(studio)
  const v = varsFor(studio, { ...lead, source: 'ig-dm' }, d.appUrl)
  v.link = `${d.appUrl}/s/${studio.slug}?src=ig-dm`
  let replied = false
  const kw = keywordHit(m2, text)
  if (kw || (isNew && (m2.igAutoReply ?? true))) {
    const body = fill(kw ? (kw.reply || DEFAULT_IG_KEYWORD_REPLY) : (m2.igWelcome || DEFAULT_IG_WELCOME), v)
    const r = await igSend(d, studio.id, { id: senderId }, body)
    await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', channel: 'instagram', body, status: r.ok ? 'sent' : 'failed', sent_by: 'auto', provider_id: r.sid ?? null, error: r.error ?? null }])
    await logEvent(d.db, lead, 'auto', r.ok ? (kw ? `Sent the link for "${kw.word}" by DM` : 'Instant DM reply sent') : `Instant DM reply not sent: ${r.error}`)
    replied = r.ok
  }
  const title = isNew ? `New Instagram DM: ${lead.name}` : `${lead.name} messaged on Instagram`
  await alertOwner(d, studio, { title, body: text.slice(0, 120), url: `/app/lead/${lead.id}`, tag: lead.id }, `${title}: "${text.slice(0, 100)}" Open: ${v.dashboard}`, title)
  return { leadId: lead.id, isNew, replied }
}

function keywordHit(m: any, text: string) {
  const list: { word: string; reply?: string }[] = m.igKeywords?.length ? m.igKeywords : DEFAULT_IG_KEYWORDS
  const words = new Set(String(text || '').toUpperCase().match(/[A-Z0-9]+/g) || [])
  return list.find((k) => k.word && words.has(k.word.trim().toUpperCase())) || null
}

async function onIgComment(d: Deps, igAccountId: string, v: any) {
  const conn = await connectionFor(d, 'instagram', igAccountId)
  if (!conn) return { skipped: 'no studio' }
  if (String(v.from?.id) === igAccountId) return { skipped: 'own comment' }
  const studio = await loadStudio(d.db, conn.studio_id)
  const m = settings(studio)
  const kw = keywordHit(m, v.text)
  if (!kw) return { skipped: 'no keyword' }
  const { lead, isNew } = await igLead(d, studio, String(v.from.id), 'ig-comment', v.text || '', v.from.username)
  const vars = varsFor(studio, lead, d.appUrl)
  vars.link = `${d.appUrl}/s/${studio.slug}?src=ig-comment`
  const body = fill(kw.reply || DEFAULT_IG_KEYWORD_REPLY, vars)
  const r = await igSend(d, studio.id, { comment_id: String(v.id) }, body)
  await d.db.insert('messages', [{ studio_id: studio.id, lead_id: lead.id, direction: 'out', channel: 'instagram', body, status: r.ok ? 'sent' : 'failed', sent_by: 'auto', provider_id: r.sid ?? null, error: r.error ?? null }])
  await logEvent(d.db, lead, 'auto', `Commented "${String(v.text || '').slice(0, 60)}" → ${r.ok ? 'sent the link by DM' : 'DM not sent: ' + r.error}`)
  const now = (d.now?.() || new Date()).toISOString()
  await d.db.update('leads', `id=${eq(lead.id)}`, { has_unread: true, last_message_at: now })
  await d.db.update('connections', `studio_id=${eq(studio.id)}&provider=eq.instagram`, { last_event_at: now })
  const title = `${lead.name} commented "${kw.word}"`
  await alertOwner(d, studio, { title, body: r.ok ? 'We DM\'d them your link.' : 'Reply to them on Instagram.', url: `/app/lead/${lead.id}`, tag: lead.id }, `${title}. Open: ${vars.dashboard}`, title)
  return { leadId: lead.id, isNew, dm: r.ok }
}

// ---------------------------------------------------------------- 4. Google Business Profile tools
export async function googleAction(d: Deps, userId: string, studioId: string, action: 'set-website' | 'refresh', location?: string) {
  const member = await d.db.one('studio_members', `studio_id=${eq(studioId)}&user_id=${eq(userId)}`)
  if (!member) return { ok: false, error: 'You don\'t have access to this studio' }
  const conn = await d.db.one('connections', `studio_id=${eq(studioId)}&provider=eq.google`)
  if (!conn || conn.status === 'disconnected') return { ok: false, error: 'Connect Google first' }
  const token = await googleToken(d, studioId)
  if (!token) return { ok: false, error: 'Google access expired. Connect again.' }
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const details = { ...(conn.details || {}) }
  if (location && details.locations?.some((l: any) => l.name === location)) details.location = location
  const loc = details.location
  if (!loc) return { ok: false, error: 'No business profile selected' }
  const studio = await loadStudio(d.db, studioId)
  const now = (d.now?.() || new Date())

  if (action === 'set-website') {
    const url = `${d.appUrl}/s/${studio.slug}?src=google`
    const r = await getJson(d, `https://mybusinessbusinessinformation.googleapis.com/v1/${loc}?updateMask=websiteUri`, { method: 'PATCH', headers: auth, body: JSON.stringify({ websiteUri: url }) })
    if (!r.ok) return { ok: false, error: googleHint(r) }
    details.locations = (details.locations || []).map((l: any) => (l.name === loc ? { ...l, websiteUri: url } : l))
    await d.db.update('connections', `studio_id=${eq(studioId)}&provider=eq.google`, { details, status: 'connected', error: null, updated_at: now.toISOString() })
    return { ok: true, websiteUri: url }
  }

  // refresh: reviews + last 30 days of profile actions
  const locId = loc.split('/').pop()
  const reviews = await getJson(d, `https://mybusiness.googleapis.com/v4/${details.account}/locations/${locId}/reviews?pageSize=5&orderBy=updateTime%20desc`, { headers: auth })
  const stars: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  const end = new Date(now.getTime() - 864e5), start = new Date(now.getTime() - 31 * 864e5)
  const range = (p: string, x: Date) => `dailyRange.${p}_date.year=${x.getUTCFullYear()}&dailyRange.${p}_date.month=${x.getUTCMonth() + 1}&dailyRange.${p}_date.day=${x.getUTCDate()}`
  const metrics = ['CALL_CLICKS', 'WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS']
  const perf = await getJson(d, `https://businessprofileperformance.googleapis.com/v1/${loc}:fetchMultiDailyMetricsTimeSeries?${metrics.map((m) => 'dailyMetrics=' + m).join('&')}&${range('start', start)}&${range('end', end)}`, { headers: auth })
  if (!reviews.ok && !perf.ok) return { ok: false, error: googleHint(reviews) }
  if (reviews.ok) {
    details.reviews = {
      average: reviews.data.averageRating ? Math.round(reviews.data.averageRating * 10) / 10 : null,
      total: reviews.data.totalReviewCount || 0,
      latest: (reviews.data.reviews || []).slice(0, 5).map((r: any) => ({ name: r.reviewer?.displayName || 'Google user', stars: stars[r.starRating] || null, text: (r.comment || '').slice(0, 400), at: r.createTime })),
    }
    // Keep the rating on the studio page accurate.
    if (details.reviews.average && details.reviews.total) {
      const cfg = { ...studio.config, rating: details.reviews.average.toFixed(1), reviewCount: String(details.reviews.total) }
      await d.db.update('studios', `id=${eq(studioId)}`, { config: cfg })
    }
  }
  if (perf.ok) {
    const sum: Record<string, number> = {}
    for (const s of perf.data.multiDailyMetricTimeSeries || []) {
      for (const t of s.dailyMetricTimeSeries || []) {
        sum[t.dailyMetric] = (t.timeSeries?.datedValues || []).reduce((a: number, x: any) => a + Number(x.value || 0), 0)
      }
    }
    details.insights = { calls: sum.CALL_CLICKS || 0, websiteClicks: sum.WEBSITE_CLICKS || 0, directions: sum.BUSINESS_DIRECTION_REQUESTS || 0, days: 30 }
  }
  details.syncedAt = now.toISOString()
  await d.db.update('connections', `studio_id=${eq(studioId)}&provider=eq.google`, { details, status: 'connected', error: null, updated_at: now.toISOString() })
  return { ok: true, details }
}

// ---------------------------------------------------------------- 5. Meta deauthorize / data deletion callbacks
export async function parseSignedRequest(signed: string, secrets: string[]): Promise<any | null> {
  const [sig, payload] = (signed || '').split('.')
  if (!sig || !payload) return null
  for (const secret of secrets.filter(Boolean)) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
    const b64 = btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (b64 === sig) {
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      try { return JSON.parse(json) } catch { return null }
    }
  }
  return null
}

export async function handleDeauthorize(d: Deps, userId: string) {
  // Meta sends the Facebook user id (Meta login) or the Instagram account id (Instagram login).
  const rows = [
    ...(await d.db.select('connections', `provider=eq.meta&details->>userId=${eq(userId)}&select=studio_id,provider`)),
    ...(await d.db.select('connections', `provider=eq.instagram&external_ids=cs.${encodeURIComponent('{' + userId + '}')}&select=studio_id,provider`)),
  ]
  for (const r of rows) {
    await d.db.remove('connection_secrets', `studio_id=${eq(r.studio_id)}&provider=eq.${r.provider}`)
    await d.db.update('connections', `studio_id=${eq(r.studio_id)}&provider=eq.${r.provider}`, { status: 'disconnected', external_ids: [], error: 'Access was removed in Facebook / Instagram settings' })
  }
  return rows.length
}
